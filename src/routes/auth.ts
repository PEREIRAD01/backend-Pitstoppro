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
	app.post(
		'/auth/register',
		{
			schema: {
				tags: ['auth'],
				summary: 'Register and receive a JWT',
				body: {
					type: 'object',
					required: ['email', 'password', 'displayName'],
					properties: {
						email: { type: 'string', format: 'email' },
						password: { type: 'string', minLength: 8 },
						displayName: { type: 'string', minLength: 1 },
					},
				},
				response: {
					201: {
						type: 'object',
						required: ['token'],
						properties: { token: { type: 'string' } },
					},
					409: {
						type: 'object',
						required: ['error'],
						properties: { error: { type: 'string' } },
					},
				},
			},
		},
		async (req, reply) => {
			const { email, password, displayName } = registerSchema.parse(req.body);
			const hash = await bcrypt.hash(password, 10);
			const user = await prisma.user.create({
				data: { email: email.toLowerCase(), passwordHash: hash, displayName },
			});
			const token = app.jwt.sign({ sub: user.id }, { expiresIn: '24h' });
			return reply.code(201).send({ token });
		},
	);

	app.post(
		'/auth/login',
		{
			schema: {
				tags: ['auth'],
				summary: 'Login and receive a JWT',
				body: {
					type: 'object',
					required: ['email', 'password'],
					properties: {
						email: { type: 'string', format: 'email' },
						password: { type: 'string', minLength: 8 },
					},
				},
				response: {
					200: {
						type: 'object',
						required: ['token'],
						properties: { token: { type: 'string' } },
					},
					401: {
						type: 'object',
						required: ['error'],
						properties: { error: { type: 'string' } },
					},
				},
			},
		},
		async (req, reply) => {
			const { email, password } = loginSchema.parse(req.body);
			const user = await prisma.user.findUnique({
				where: { email: email.toLowerCase() },
			});
			if (!user) throw new AppError('Invalid credentials', 401);
			const ok = await bcrypt.compare(password, user.passwordHash);
			if (!ok) throw new AppError('Invalid credentials', 401);
			const token = app.jwt.sign({ sub: user.id }, { expiresIn: '24h' });
			return { token };
		},
	);

	app.get(
		'/auth/me',
		{
			preHandler: app.authenticate,
			schema: {
				tags: ['auth'],
				summary: 'Get current authenticated user',
				security: [{ bearerAuth: [] }],
				response: {
					200: {
						type: 'object',
						required: ['id', 'email', 'displayName'],
						properties: {
							id: { type: 'number' },
							email: { type: 'string', format: 'email' },
							displayName: { type: 'string' },
						},
					},
					401: {
						type: 'object',
						required: ['error'],
						properties: { error: { type: 'string' } },
					},
				},
			},
		},
		async (req: any) => {
			const userId = Number(req.user.sub);
			const user = await prisma.user.findUnique({ where: { id: userId } });
			if (!user) throw new AppError('Not found', 404);
			return { id: user.id, email: user.email, displayName: user.displayName };
		},
	);
}
