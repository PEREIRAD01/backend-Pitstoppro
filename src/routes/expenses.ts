import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../db/prisma';
import { AppError } from '../errors';
import { listExpenses as svcListExpenses, createExpense as svcCreateExpense } from '../services/expenses-service';

const categoryEnum = z.enum(['part','event','insurance','inspection','iuc','custom']);

export default async function expenses(app: FastifyInstance) {
  const idParam = z.object({ id: z.coerce.number().int().positive() });

  app.get(
    '/expenses',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['expenses'],
        summary: 'List expenses',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: { vehicleId: { type: 'integer', minimum: 1 }, from: { type: 'string', format: 'date' }, to: { type: 'string', format: 'date' }, category: { type: 'string', enum: ['part','event','insurance','inspection','iuc','custom'] } },
        },
        response: { 200: { type: 'object', required: ['data'], properties: { data: { type: 'array', items: { type: 'object', additionalProperties: true } } } } },
      },
    },
    async (req: any) => {
      const userId = Number(req.user.sub);
      const { vehicleId, from, to, category } = req.query as any;
      return svcListExpenses(userId, {
        vehicleId: vehicleId ? Number(vehicleId) : undefined,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        category,
      });
    },
  );

  app.post(
    '/expenses',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['expenses'],
        summary: 'Create expense',
        security: [{ bearerAuth: [] }],
        body: {
          oneOf: [
            {
              type: 'object',
              required: ['trackedItemId', 'expenseDate', 'amountEur', 'category'],
              properties: {
                trackedItemId: { type: 'integer', minimum: 1 },
                vehicleEventId: { type: 'integer', minimum: 1 },
                expenseDate: { type: 'string', format: 'date' },
                amountEur: { type: 'string' },
                category: { type: 'string', enum: ['part','event','insurance','inspection','iuc','custom'] },
                description: { type: 'string' },
                vendor: { type: 'string' },
              },
              not: { required: ['vehicleEventId'] },
              examples: [
                {
                  trackedItemId: 1,
                  expenseDate: '2025-10-24',
                  amountEur: '20.00',
                  category: 'part',
                  description: 'escovas',
                  vendor: 'ze'
                }
              ],
            },
            {
              type: 'object',
              required: ['vehicleEventId', 'expenseDate', 'amountEur', 'category'],
              properties: {
                trackedItemId: { type: 'integer', minimum: 1 },
                vehicleEventId: { type: 'integer', minimum: 1 },
                expenseDate: { type: 'string', format: 'date' },
                amountEur: { type: 'string' },
                category: { type: 'string', enum: ['part','event','insurance','inspection','iuc','custom'] },
                description: { type: 'string' },
                vendor: { type: 'string' },
              },
              not: { required: ['trackedItemId'] },
              examples: [
                {
                  vehicleEventId: 2,
                  expenseDate: '2025-10-24',
                  amountEur: '45.90',
                  category: 'inspection',
                  description: 'IPO',
                  vendor: 'centro X'
                }
              ],
            },
          ],
        },
        response: { 201: { type: 'object', required: ['id'], properties: { id: { type: 'number' } } } },
      },
    },
    async (req: any, reply) => {
      const userId = Number(req.user.sub);
      const body = z
        .object({
          trackedItemId: z.number().int().positive().optional(),
          vehicleEventId: z.number().int().positive().optional(),
          expenseDate: z.coerce.date(),
          amountEur: z.string(),
          category: categoryEnum,
          description: z.string().optional(),
          vendor: z.string().optional(),
        })
        .parse(req.body);

      const result = await svcCreateExpense(userId, body as any);
      return reply.code(201).send(result);
    },
  );
}
