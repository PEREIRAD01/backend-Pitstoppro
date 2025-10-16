import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';

import { env } from './env';
import health from './routes/health';
import auth from './routes/auth';
import vehicles from './routes/vehicles';
import authGuard from './plugins/auth-guard';
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


	await app.register(jwt, { secret: env.JWT_SECRET });

	await app.register(helmet);
	await app.register(cors, {
		origin: ['http://localhost:5173', 'http://localhost:3333'],
		credentials: true,
	});

	await app.register(swagger, {
		openapi: {
			info: { title: 'PitStop Pro API', version: '1.0.0' },
			servers: [{ url: 'http://localhost:3333/v1' }],
			components: {
				securitySchemes: {
					bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
				},
			},
		},
	});

	await app.register(swaggerUI, {
		routePrefix: '/docs',
		uiConfig: { docExpansion: 'list', deepLinking: false },
	});

	
	app.register(authGuard);
	registerErrorHandler(app);

	app.register(health, { prefix: '/v1' });
	app.register(auth, { prefix: '/v1' });
	app.register(vehicles, { prefix: '/v1' });

	return app;
}
