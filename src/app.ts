import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { env } from './env.js';
import health from './routes/health.js';

export function buildApp() {
	const app = Fastify({ logger: true });
	app.register(jwt, { secret: env.jwtSecret });
	app.register(health);
	return app;
}
