import { FastifyInstance } from 'fastify';
import prisma from '../db/prisma';
import { z } from 'zod';
import { AppError } from '../errors';
import { todayMidnight, calcOverdue } from '../lib/date-utils';
import { createVehicle as svcCreateVehicle, updateVehicle as svcUpdateVehicle, listVehicles as svcListVehicles, deleteVehicle as svcDeleteVehicle } from '../services/vehicles-service';

const createSchema = z.object({
	plate: z.string().min(1).max(20).trim(),
	brand: z.string().min(1).max(100).trim(),
	model: z.string().min(1).max(100).trim(),
	year: z.number().int().min(1900).max(2100).optional(),
	vehicleName: z.string().min(1).max(100).trim().optional(),
	currentOdometerKm: z.number().int().min(0).optional(),
	isElectric: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

const idParamSchema = z.object({
	id: z.coerce.number().int().positive(),
});

export default async function vehicles(app: FastifyInstance) {
		app.get(
			'/vehicles/:id/overview',
			{
				preHandler: app.authenticate,
				schema: {
					tags: ['vehicles'],
					summary: 'Get vehicle overview (details + upcoming + recent)',
					security: [{ bearerAuth: [] }],
					params: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } }, required: ['id'] },
					response: {
						200: {
							type: 'object',
							required: ['vehicle', 'hasPhoto', 'upcomingEvents', 'pendingTrackedItems', 'recentExpenses'],
							properties: {
								vehicle: {
									type: 'object',
									properties: {
										id: { type: 'number' },
										plate: { type: 'string' },
										brand: { type: 'string' },
										model: { type: 'string' },
                        year: { type: 'integer', nullable: true },
                        vehicleName: { type: 'string', nullable: true },
                        currentOdometerKm: { type: 'integer', nullable: true },
									},
									additionalProperties: true,
								},
								hasPhoto: { type: 'boolean' },
								upcomingEvents: { type: 'array', items: { type: 'object', additionalProperties: true } },
								pendingTrackedItems: { type: 'array', items: { type: 'object', additionalProperties: true } },
								recentExpenses: { type: 'array', items: { type: 'object', additionalProperties: true } },
							},
						},
						404: { type: 'object', required: ['error'], properties: { error: { type: 'string' } } },
					},
				},
			},
			async (req: any) => {
				const userId = Number(req.user.sub);
				const { id } = idParamSchema.parse(req.params);

				const v = await prisma.vehicle.findFirst({
					where: { id, userId },
					select: {
						id: true,
						plate: true,
						brand: true,
						model: true,
                        year: true,
                        vehicleName: true,
                        currentOdometerKm: true,
                        photoBytes: true,
					},
				});
				if (!v) throw new AppError('Not found', 404);

                const hasPhoto = Boolean(v.photoBytes);
				const { photoBytes, ...vehicle } = v as any;

				const today = todayMidnight();

				// Eventos: dueDate é obrigatório por schema → basta ordenar por dueDate asc
				const events = await prisma.vehicleEvent.findMany({
					where: { vehicleId: id, isDone: false },
					orderBy: { dueDate: 'asc' },
					take: 5,
				});
				const upcomingEvents = events.map((e) => ({ ...e, ...calcOverdue(e.dueDate, today) }));

				// Tracked items: com dueDate primeiro, depois sem dueDate (até 5 no total)
				const tiWithDue = await prisma.trackedItem.findMany({
					where: { vehicleId: id, isDone: false, dueDate: { not: null } },
					orderBy: { dueDate: 'asc' },
					take: 5,
				});
				const remainingT = Math.max(0, 5 - tiWithDue.length);
				const tiNoDue = remainingT > 0 ? await prisma.trackedItem.findMany({ where: { vehicleId: id, isDone: false, dueDate: null }, orderBy: { id: 'asc' }, take: remainingT }) : [];
				const pendingTrackedItems = [...tiWithDue, ...tiNoDue].map((t) => ({ ...t, ...calcOverdue(t.dueDate, today) }));

				const recentExpenses = await prisma.expense.findMany({
						where: {
							OR: [
								{ vehicleEvent: { vehicleId: id, vehicle: { userId } } },
								{ trackedItem: { vehicleId: id, vehicle: { userId } } },
							],
						},
						orderBy: { expenseDate: 'desc' },
						take: 5,
					});

				return { vehicle, hasPhoto, upcomingEvents, pendingTrackedItems, recentExpenses };
			},
		);
		app.get(
			'/vehicles',
			{
				preHandler: app.authenticate,
				schema: {
					tags: ['vehicles'],
					summary: 'List my vehicles (paginated)',
					security: [{ bearerAuth: [] }],
					querystring: {
						type: 'object',
						properties: {
							page: { type: 'integer', minimum: 1, default: 1 },
							limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
							sort: {
								type: 'string',
								description: 'field:direction',
								enum: ['id:asc', 'id:desc', 'plate:asc', 'plate:desc', 'brand:asc', 'brand:desc', 'model:asc', 'model:desc'],
								default: 'id:desc',
							},
						},
					},
					response: {
					200: {
						type: 'object',
						required: ['data', 'page', 'limit', 'total', 'pages'],
						properties: {
							data: {
								type: 'array',
								items: {
									type: 'object',
									required: ['id', 'plate', 'brand', 'model'],
									properties: {
										id: { type: 'number' },
										plate: { type: 'string' },
										brand: { type: 'string' },
                        model: { type: 'string' },
										year: { type: 'integer', nullable: true },
										vehicleName: { type: 'string', nullable: true },
										currentOdometerKm: { type: 'integer', nullable: true },
										isElectric: { type: 'boolean', nullable: true },
									},
									additionalProperties: true,
								},
							},
							page: { type: 'integer' },
							limit: { type: 'integer' },
							total: { type: 'integer' },
							pages: { type: 'integer' },
						},
					},
				},
			},
		},
		async (req: any) => {
			const userId = Number(req.user.sub);

			const qSchema = z.object({
				page: z.coerce.number().int().min(1).default(1),
				limit: z.coerce.number().int().min(1).max(100).default(10),
				sort: z
					.string()
					.regex(/^(id|plate|brand|model):(asc|desc)$/i)
					.default('id:desc'),
			});

            const { page, limit, sort } = qSchema.parse(req.query);
            const [field, dir] = sort.split(':') as ['id' | 'plate' | 'brand' | 'model', 'asc' | 'desc'];

            return svcListVehicles(userId, { page, limit, sortField: field, sortDir: dir });
        },
    );

	app.post(
		'/vehicles',
		{
			preHandler: app.authenticate,
			schema: {
				tags: ['vehicles'],
				summary: 'Create a vehicle',
				security: [{ bearerAuth: [] }],
				body: {
					type: 'object',
					required: ['plate', 'brand', 'model'],
					properties: {
						plate: { type: 'string' },
						brand: { type: 'string' },
                        model: { type: 'string' },
						year: { type: 'integer', minimum: 1900, maximum: 2100 },
						vehicleName: { type: 'string' },
						currentOdometerKm: { type: 'integer', minimum: 0 },
						isElectric: { type: 'boolean' },
					},
				},
				response: {
					201: {
						type: 'object',
						required: ['id'],
						properties: {
							id: { type: 'number' },
						},
					},
					409: {
						type: 'object',
						required: ['error'],
						properties: { error: { type: 'string' } },
					},
				},
			},
		},
    async (req: any, reply) => {
            const userId = Number(req.user.sub);
            const data = createSchema.parse(req.body);

            const result = await svcCreateVehicle(userId, data);
            return reply.code(201).send(result);
        },
	);

    app.patch(
        '/vehicles/:id',
        {
            preHandler: app.authenticate,
            schema: {
                tags: ['vehicles'],
                summary: 'Update a vehicle',
                security: [{ bearerAuth: [] }],
                params: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } }, required: ['id'] },
                body: {
                    type: 'object',
                    properties: {
                        plate: { type: 'string' },
                        brand: { type: 'string' },
                        model: { type: 'string' },
                        year: { type: 'integer', minimum: 1900, maximum: 2100 },
                        vehicleName: { type: 'string' },
                        currentOdometerKm: { type: 'integer', minimum: 0 },
                        isElectric: { type: 'boolean' },
                    },
                },
                response: {
                    200: {
                        type: 'object',
                        required: ['id'],
                        properties: { id: { type: 'number' } },
                    },
                },
            },
        },
    async (req: any) => {
            const userId = Number(req.user.sub);
            const { id } = idParamSchema.parse(req.params);
            const data = updateSchema.parse(req.body);

            return svcUpdateVehicle(userId, id, data);
        },
    );

	app.delete(
		'/vehicles/:id',
		{
			preHandler: app.authenticate,
			schema: {
				tags: ['vehicles'],
				summary: 'Delete a vehicle',
				security: [{ bearerAuth: [] }],
				params: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } }, required: ['id'] },
				response: { 204: { type: 'null' } },
			},
		},
        async (req: any, reply) => {
            const userId = Number(req.user.sub);
            const { id } = idParamSchema.parse(req.params);

            await svcDeleteVehicle(userId, id);
            return reply.status(204).send();
        },
	);

	app.post(
		'/vehicles/:id/photo',
		{
			preHandler: app.authenticate,
			schema: {
				tags: ['vehicles'],
				summary: 'Upload vehicle photo',
				security: [{ bearerAuth: [] }],
				consumes: ['multipart/form-data'],
				params: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } }, required: ['id'] },
				body: {
					type: 'object',
					properties: {
						file: {
							anyOf: [
								{ type: 'string', format: 'binary' },
								{ type: 'object' },
							],
						},
					},
				},
				response: { 204: { type: 'null' } },
			},
		},
		async (req: any, reply) => {
			const userId = Number(req.user.sub);
			const { id } = idParamSchema.parse(req.params);

			const vehicle = await prisma.vehicle.findFirst({ where: { id, userId } });
			if (!vehicle) throw new AppError('Not found', 404);

			let upload: any = (req as any).body?.file;
			if (!upload || typeof upload.toBuffer !== 'function') {
				upload = await (req as any).file();
			}
			if (!upload) throw new AppError('File is required', 400);
			const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
			if (!upload.mimetype || !ALLOWED_MIMES.includes(upload.mimetype)) {
				throw new AppError('Only JPEG, PNG, WebP or GIF images are accepted', 400);
			}

			const buf = await upload.toBuffer();
			await prisma.vehicle.update({ where: { id }, data: { photoBytes: buf, photoMimeType: upload.mimetype } });
			return reply.status(204).send();
		},
	);

	app.get(
		'/vehicles/:id/photo',
		{
			preHandler: app.authenticate,
			schema: {
				tags: ['vehicles'],
				summary: 'Download vehicle photo',
				security: [{ bearerAuth: [] }],
				params: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } }, required: ['id'] },
				response: { 200: { type: 'string', format: 'binary' }, 404: { type: 'object', properties: { error: { type: 'string' } }, required: ['error'] } },
			},
		},
		async (req: any, reply) => {
			const userId = Number(req.user.sub);
			const { id } = idParamSchema.parse(req.params);

			const vehicle = await prisma.vehicle.findFirst({ where: { id, userId }, select: { photoBytes: true, photoMimeType: true } });
			if (!vehicle || !vehicle.photoBytes) throw new AppError('Not found', 404);

			reply.header('Content-Type', vehicle.photoMimeType || 'application/octet-stream');
			return reply.send(Buffer.from(vehicle.photoBytes));
		},
	);
}
