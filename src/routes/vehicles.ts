import { FastifyInstance } from 'fastify';
import prisma from '../db/prisma';

export default async function vehicles(app: FastifyInstance) {
	app.addHook('preHandler', async req => {
		await req.jwtVerify();
	});

	app.get('/vehicles', async (req: any) => {
		const userId = Number(req.user.sub);
		const rows = await prisma.vehicle.findMany({
			where: { userId },
			orderBy: { id: 'desc' },
		});
		return rows;
	});
}
