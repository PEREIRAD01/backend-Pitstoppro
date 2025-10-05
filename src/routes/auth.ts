import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../db/prisma';
import bcrypt from 'bcrypt';
import { AppError } from '../errors';

const registerSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6),
	displayName: z.string().min(1),
});

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6),
});

export default async function auth(app: FastifyInstance) {
	app.post('/auth/register', async (req, reply) => {
		const body = registerSchema.parse(req.body);
		const hash = await bcrypt.hash(body.password, 10);
		const user = await prisma.user.create({
			data: { email: body.email, passwordHash: hash, displayName: body.displayName },
		});
		const token = app.jwt.sign({ sub: user.id });
		return reply.code(201).send({ token });
	});

	app.post('/auth/login', async req => {
		const body = loginSchema.parse(req.body);
		const user = await prisma.user.findUnique({ where: { email: body.email } });
		if (!user) throw new AppError('Invalid credentials', 401);
		const ok = await bcrypt.compare(body.password, user.passwordHash);
		if (!ok) throw new AppError('Invalid credentials', 401);
		const token = (req.server as any).jwt.sign({ sub: user.id });
		return { token };
	});

	app.get('/auth/me', { preHandler: [verify] }, async (req: any) => {
		const userId = Number(req.user.sub);
		const user = await prisma.user.findUnique({ where: { id: userId } });
		if (!user) throw new AppError('Not found', 404);
		return { id: user.id, email: user.email, displayName: user.displayName };
	});

	async function verify(req: any) {
		await req.jwtVerify();
	}
}
