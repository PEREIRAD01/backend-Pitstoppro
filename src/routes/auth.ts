import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../db/prisma';
import * as bcrypt from 'bcrypt';
import { AppError } from '../errors';

const registerSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
	displayName: z.string().min(1),
});

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
});

export default async function auth(app: FastifyInstance) {
	// REGISTER
	app.post('/auth/register', async (req, reply) => {
		const { email, password, displayName } = registerSchema.parse(req.body);
		const hash = await bcrypt.hash(password, 10);

		const user = await prisma.user.create({
			data: { email: email.toLowerCase(), passwordHash: hash, displayName },
		});

		const token = app.jwt.sign({ sub: user.id }, { expiresIn: '24h' });
		return reply.code(201).send({ token });
	});

	// LOGIN
	app.post('/auth/login', async (req, reply) => {
		const { email, password } = loginSchema.parse(req.body);

		const user = await prisma.user.findUnique({
			where: { email: email.toLowerCase() },
		});
		if (!user) throw new AppError('Invalid credentials', 401);

		const ok = await bcrypt.compare(password, user.passwordHash);
		if (!ok) throw new AppError('Invalid credentials', 401);

		const token = app.jwt.sign({ sub: user.id }, { expiresIn: '24h' });
		return { token };
	});

	// ME
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
