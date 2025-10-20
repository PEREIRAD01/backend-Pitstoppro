import { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.status).send({ error: err.message });
    }

    if (err instanceof ZodError) {
      return reply.status(400).send({ error: 'ValidationError' });
    }

    const anyErr = err as any;
    if (anyErr && anyErr.code === 'FST_ERR_CTP_INVALID_JSON') {
      return reply.status(400).send({ error: 'InvalidJson' });
    }

    if (anyErr && typeof anyErr.code === 'string' && anyErr.code.startsWith('FST_JWT_')) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    app.log.error(err);
    return reply.status(500).send({ error: 'Internal Server Error' });
  });
}

