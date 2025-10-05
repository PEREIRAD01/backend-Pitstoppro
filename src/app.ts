import Fastify from 'fastify';
import health from './routes/health.js';

export function buildApp() {
	const app = Fastify({ logger: true });
	app.register(health);
	return app;
}
