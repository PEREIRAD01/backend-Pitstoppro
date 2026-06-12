import { FastifyInstance } from 'fastify';

export default async function meta(app: FastifyInstance) {
  app.get(
    '/meta/enums',
    {
      schema: {
        tags: ['meta'],
        summary: 'List domain enums for clients',
        response: {
          200: {
            type: 'object',
            required: ['eventTypes', 'trackedItemTypes', 'expenseCategories'],
            properties: {
              eventTypes: { type: 'array', items: { type: 'string', enum: ['insurance', 'inspection', 'iuc', 'custom'] } },
              trackedItemTypes: { type: 'array', items: { type: 'string', enum: ['event', 'part'] } },
              expenseCategories: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['part','event','insurance','inspection','iuc','custom'],
                },
              },
            },
          },
        },
      },
    },
    async (_req, reply) => {
      // Valores alinhados com prisma/schema.prisma
      const eventTypes = ['insurance', 'inspection', 'iuc', 'custom'] as const;
      const trackedItemTypes = ['event', 'part'] as const;
      const expenseCategories = ['part','event','insurance','inspection','iuc','custom'] as const;

      reply.header('Cache-Control', 'public, max-age=3600');
      return { eventTypes, trackedItemTypes, expenseCategories };
    },
  );
}
