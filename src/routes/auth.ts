import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../db/prisma';
import * as bcrypt from 'bcrypt';
import { AppError } from '../errors';

const registerSchema = z.object({
	email: z.string().email().max(254).trim(),
	password: z
		.string()
		.min(8, 'Password must be at least 8 characters')
		.regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
		.regex(/[0-9]/, 'Password must contain at least one digit'),
	displayName: z.string().min(1).max(100).trim(),
});

const loginSchema = z.object({
	email: z.string().email().max(254).trim(),
	password: z.string().min(1),
});

export default async function auth(app: FastifyInstance) {
	app.post(
		'/auth/register',
		{
			config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
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
			config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
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

	app.patch(
		'/auth/me',
		{
			preHandler: app.authenticate,
			schema: {
				tags: ['auth'],
				summary: 'Update current user profile (displayName and/or email)',
				security: [{ bearerAuth: [] }],
				body: {
					type: 'object',
					properties: {
						displayName: { type: 'string', minLength: 1 },
						email: { type: 'string', format: 'email' },
					},
				},
				response: {
					200: {
						type: 'object',
						properties: {
							id: { type: 'number' },
							email: { type: 'string' },
							displayName: { type: 'string' },
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
		async (req: any) => {
			const userId = Number(req.user.sub);
			const updateSchema = z
				.object({
					displayName: z.string().min(1).max(100).trim().optional(),
					email: z.string().email().max(254).trim().optional(),
				})
				.refine(d => d.displayName !== undefined || d.email !== undefined, {
					message: 'At least one field (displayName or email) must be provided',
				});

			const { displayName, email } = updateSchema.parse(req.body);

			if (email) {
				const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
				if (existing && existing.id !== userId) throw new AppError('Email already in use', 409);
			}

			const data: { displayName?: string; email?: string } = {};
			if (displayName !== undefined) data.displayName = displayName;
			if (email !== undefined) data.email = email.toLowerCase();

			const user = await prisma.user.update({ where: { id: userId }, data });
			return { id: user.id, email: user.email, displayName: user.displayName };
		},
	);

	app.post(
		'/auth/change-password',
		{
			preHandler: app.authenticate,
			schema: {
				tags: ['auth'],
				summary: 'Change current user password',
				security: [{ bearerAuth: [] }],
				body: {
					type: 'object',
					required: ['currentPassword', 'newPassword'],
					properties: {
						currentPassword: { type: 'string' },
						newPassword: { type: 'string', minLength: 8 },
					},
				},
				response: { 204: { type: 'null' } },
			},
		},
		async (req: any, reply) => {
			const userId = Number(req.user.sub);
			const { currentPassword, newPassword } = z.object({
				currentPassword: z.string().min(1),
				newPassword: z.string().min(8).regex(/[A-Z]/, 'Must contain uppercase').regex(/[0-9]/, 'Must contain digit'),
			}).parse(req.body);

			const user = await prisma.user.findUnique({ where: { id: userId } });
			if (!user) throw new AppError('Not found', 404);

			const ok = await bcrypt.compare(currentPassword, user.passwordHash);
			if (!ok) throw new AppError('Incorrect current password', 401);

			const hash = await bcrypt.hash(newPassword, 10);
			await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
			return reply.status(204).send();
		},
	);

	app.delete(
		'/auth/me',
		{
			preHandler: app.authenticate,
			schema: {
				tags: ['auth'],
				summary: 'Delete current user account',
				security: [{ bearerAuth: [] }],
				response: { 204: { type: 'null' } },
			},
		},
		async (req: any, reply) => {
			const userId = Number(req.user.sub);
			await prisma.user.delete({ where: { id: userId } });
			return reply.status(204).send();
		},
	);
}
