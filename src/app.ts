import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { env } from './env';
import health from './routes/health';
import auth from './routes/auth';
import { registerErrorHandler } from './errors';

export async function buildApp() {
	const isProd = env.NODE_ENV === 'production';

	const app = Fastify({
		logger: isProd
			? true
			: {
					transport: {
						target: 'pino-pretty',
						options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
					},
			  },
	});

	app.register(jwt, { secret: env.JWT_SECRET });

	await app.register(helmet);
	await app.register(cors, {
		origin: ['http://localhost:5173', 'http://localhost:3333'],
		credentials: true,
	});

	registerErrorHandler(app);

	app.register(health, { prefix: '/v1' });
	app.register(auth, { prefix: '/v1' });

	return app;
}
