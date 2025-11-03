import { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'AppError';
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
        details: err.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return reply.status(409).send({ error: 'UniqueConstraint' });
    }

    const anyErr = err as any;
    const code = typeof anyErr?.code === 'string' ? anyErr.code : undefined;

    if (code === 'FST_ERR_CTP_INVALID_JSON' || code === 'FST_ERR_CTP_INVALID_JSON_BODY') {
      return reply.status(400).send({ error: 'InvalidJson' });
    }

    if (code && code.startsWith('FST_JWT')) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const statusCode = typeof anyErr?.statusCode === 'number' ? anyErr.statusCode : 500;
    if (process.env.NODE_ENV === 'test') {
      console.error(err);
    } else {
      req.log.error({ err }, 'Unhandled error');
    }

    const body = statusCode >= 500 ? { error: 'Internal Server Error' } : { error: anyErr?.message ?? 'Error' };
    return reply.status(statusCode).send(body);
  });
}
