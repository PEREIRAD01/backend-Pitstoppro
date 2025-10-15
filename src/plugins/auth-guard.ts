import fp from 'fastify-plugin';

export default fp(async function authGuard(app) {
	app.decorate('authenticate', async function (req, reply) {
		await req.jwtVerify();
	});
});

declare module 'fastify' {
	interface FastifyInstance {
		authenticate: (req: any, reply: any) => Promise<void>;
	}
}
