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
	app.setErrorHandler((err: any, req, reply) => {
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
		
		if (err?.code === 'FST_ERR_CTP_INVALID_JSON_BODY') {
			return reply.status(400).send({ error: 'InvalidJson', message: 'Body must be valid JSON' });
		}
		
		if (typeof err?.code === 'string' && err.code.startsWith('FST_JWT')) {
			return reply.status(401).send({ error: 'Unauthorized' });
		}

		
		const status = Number(err?.statusCode) || 500;
		req.log.error({ err }, 'Unhandled error');
		return reply.status(status).send({ error: 'InternalServerError' });
	});
}
