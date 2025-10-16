import { FastifyInstance } from 'fastify';
import prisma from '../db/prisma';
import { z } from 'zod';
import { AppError } from '../errors';

const createSchema = z.object({
	plate: z.string().min(1),
	brand: z.string().min(1),
	model: z.string().min(1),
	photoUrl: z.string().url().optional(),
});

const updateSchema = createSchema.partial();

const idParamSchema = z.object({
	id: z.coerce.number().int().positive(),
});

export default async function vehicles(app: FastifyInstance) {
	app.get(
		'/vehicles',
		{
			preHandler: app.authenticate,
			schema: {
				tags: ['vehicles'],
				summary: 'List my vehicles (paginated)',
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
										photoUrl: { type: 'string', nullable: true },
									},
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
						photoUrl: { type: 'string' },
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
}
