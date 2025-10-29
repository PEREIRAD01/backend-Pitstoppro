import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import multipart from '@fastify/multipart';

import { env } from './env';
import health from './routes/health';
import auth from './routes/auth';
import vehicles from './routes/vehicles';
import events from './routes/events';
import expenses from './routes/expenses';
import trackedItems from './routes/tracked-items';
import dashboard from './routes/dashboard';
import authGuard from './plugins/auth-guard';
import { registerErrorHandler } from './errors';
import prisma from './db/prisma';

export async function buildApp() {
	const isProd = env.NODE_ENV === 'production';
	const isTest = env.NODE_ENV === 'test';

	const app = Fastify({
		logger: isTest
			? false
			: isProd
				? true
				: {
						transport: {
							target: 'pino-pretty',
							options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
						},
				  },
		ajv: { customOptions: { keywords: ['isFile'] } },
	});


	await app.register(jwt, { secret: env.JWT_SECRET });

	await app.register(multipart, { attachFieldsToBody: true, limits: { fileSize: 10_000_000 } });

	if (!isTest) {
		await app.register(helmet);
		await app.register(cors, {
			origin: ['http://localhost:5173', 'http://localhost:3333'],
			credentials: true,
		});
	}

	if (!isTest) {
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
	}

	
	app.register(authGuard);
	registerErrorHandler(app);

	app.addHook('onClose', async () => {
		await prisma.$disconnect();
	});

	app.register(health, { prefix: '/v1' });
	app.register(auth, { prefix: '/v1' });
	app.register(vehicles, { prefix: '/v1' });
	app.register(events, { prefix: '/v1' });
	app.register(expenses, { prefix: '/v1' });
	app.register(trackedItems, { prefix: '/v1' });
  app.register(dashboard, { prefix: '/v1' });

	return app;
}
