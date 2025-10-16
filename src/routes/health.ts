import { FastifyInstance } from 'fastify';

export default async function health(app: FastifyInstance) {
	app.get(
		'/health',
		{
			schema: {
				tags: ['system'],
				summary: 'Health check',
				response: {
					200: {
						type: 'object',
						properties: { ok: { type: 'boolean' } },
						required: ['ok'],
					},
				},
			},
		},
		async () => ({ ok: true }),
	);
}
