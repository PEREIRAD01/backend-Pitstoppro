import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { env } from './env';
import health from './routes/health';
import auth from './routes/auth';
import { registerErrorHandler } from './errors';

export function buildApp() {
	const app = Fastify({ logger: true });
	app.register(jwt, { secret: env.jwtSecret });
	registerErrorHandler(app);
	app.register(health);
	app.register(auth);
	return app;
}
