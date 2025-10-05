import { buildApp } from './app';
import { env } from './env';

async function start() {
	const app = await buildApp();
	await app.listen({ port: env.PORT, host: '0.0.0.0' });
}
start().catch(err => {
	console.error(err);
	process.exit(1);
});
