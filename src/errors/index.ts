import { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
	status: number;
	constructor(message: string, status = 400) {
		super(message);
		this.status = status;
	}
}

export function registerErrorHandler(app: FastifyInstance) {
	app.setErrorHandler((err, req, reply) => {
		if (err instanceof AppError) {
			return reply.status(err.status).send({ error: err.message });
		}
		if (err instanceof ZodError) {
			return reply.status(400).send({
				error: 'ValidationError',
				details: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
			});
		}
		if (err instanceof Prisma.PrismaClientKnownRequestError) {
			if (err.code === 'P2002') {
				return reply.status(409).send({ error: 'Conflict', message: 'Duplicated unique value' });
			}
		}
		const code = (err as any)?.code as string | undefined;
		if (code && code.startsWith('FST_JWT')) {
			return reply.status(401).send({ error: 'Unauthorized' });
		}
		req.log.error({ err }, 'Unhandled error');
		return reply.status(500).send({ error: 'InternalServerError' });
	});
}
