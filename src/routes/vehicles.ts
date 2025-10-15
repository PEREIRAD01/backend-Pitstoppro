import { FastifyInstance } from 'fastify';
import prisma from '../db/prisma';
import { z } from 'zod';
import { AppError } from '../errors';

const vehicleSchema = z.object({
	plate: z.string().min(1),
	brand: z.string().min(1),
	model: z.string().min(1),
	photoUrl: z.string().url().optional(),
});

export default async function vehicles(app: FastifyInstance) {
	
	app.get('/vehicles', { preHandler: app.authenticate }, async (req: any) => {
		const userId = Number(req.user.sub);
		return prisma.vehicle.findMany({
			where: { userId },
			orderBy: { id: 'desc' },
		});
	});

		app.post('/vehicles', { preHandler: app.authenticate }, async (req: any, reply) => {
		const body = vehicleSchema.parse(req.body);
		const userId = Number(req.user.sub);

		try {
			const created = await prisma.vehicle.create({ data: { ...body, userId } });
			return reply.code(201).send(created);
		} catch (err: any) {
			if (err?.code === 'P2002') throw new AppError('Plate already exists for this user', 409);
			throw err;
		}
	});
}
