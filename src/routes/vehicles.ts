import { FastifyInstance } from 'fastify';
import prisma from '../db/prisma';
import { z } from 'zod';
import { AppError } from '../errors';

const createSchema = z.object({
	plate: z.string().min(1),
	brand: z.string().min(1),
	model: z.string().min(1),
	year: z.number().int().min(1900).max(2100).optional(),
	vehicleName: z.string().min(1).optional(),
	currentOdometerKm: z.number().int().min(0).optional(),
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

				const [upcomingEvents, pendingTrackedItems, recentExpenses] = await Promise.all([
					prisma.vehicleEvent.findMany({ where: { vehicleId: id, isDone: false }, orderBy: { dueDate: 'asc' }, take: 5 }),
					prisma.trackedItem.findMany({ where: { vehicleId: id, isDone: false }, orderBy: [{ dueDate: 'asc' }, { id: 'asc' }], take: 5 }),
					prisma.expense.findMany({
						where: {
							OR: [
								{ vehicleEvent: { vehicleId: id, vehicle: { userId } } },
								{ trackedItem: { vehicleId: id, vehicle: { userId } } },
							],
						},
						orderBy: { expenseDate: 'desc' },
						take: 5,
					}),
				]);

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

			const [data, total] = await Promise.all([
				prisma.vehicle.findMany({
					where: { userId },
					orderBy: { [field]: dir },
					skip: (page - 1) * limit,
					take: limit,
				}),
				prisma.vehicle.count({ where: { userId } }),
			]);

			return { data, page, limit, total, pages: Math.ceil(total / limit) };
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

			const exists = await prisma.vehicle.findFirst({
				where: { userId, plate: data.plate },
			});
			if (exists) throw new AppError('Vehicle with this plate already exists', 409);

			const created = await prisma.vehicle.create({
				data: { ...data, userId },
			});

			return reply.code(201).send({ id: created.id });
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
						photoUrl: { type: 'string' },
						year: { type: 'integer', minimum: 1900, maximum: 2100 },
						vehicleName: { type: 'string' },
						currentOdometerKm: { type: 'integer', minimum: 0 },
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

			const vehicle = await prisma.vehicle.findFirst({ where: { id, userId } });
			if (!vehicle) throw new AppError('Not found', 404);

			const updated = await prisma.vehicle.update({
				where: { id },
				data,
			});

			return { id: updated.id };
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

			const vehicle = await prisma.vehicle.findFirst({ where: { id, userId } });
			if (!vehicle) throw new AppError('Not found', 404);

			await prisma.vehicle.delete({ where: { id } });
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
			if (!upload.mimetype || !upload.mimetype.startsWith('image/')) throw new AppError('Only image files are accepted', 400);

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
