import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../db/prisma';
import { AppError } from '../errors';
import { createExpense as svcCreateExpense } from '../services/expenses-service';
import { listForVehicle as svcListForVehicle, createForVehicle as svcCreateForVehicle, updateEvent as svcUpdateEvent } from '../services/events-service';

const eventTypeEnum = z.enum(['insurance', 'inspection', 'iuc', 'custom']);

export default async function events(app: FastifyInstance) {
  const idParam = z.object({ id: z.coerce.number().int().positive() });

  app.get(
    '/vehicles/:id/events',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['events'],
        summary: 'List vehicle events',
        security: [{ bearerAuth: [] }],
        params: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } }, required: ['id'] },
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['pending', 'done'] },
            from: { type: 'string', format: 'date' },
            to: { type: 'string', format: 'date' },
            eventType: { type: 'string', enum: ['insurance', 'inspection', 'iuc', 'custom'] },
          },
        },
        response: { 200: { type: 'array', items: { type: 'object', additionalProperties: true } } },
      },
    },
    async (req: any) => {
      const userId = Number(req.user.sub);
      const { id: vehicleId } = idParam.parse(req.params);
      const q = req.query as any;
      return svcListForVehicle(userId, vehicleId, {
        status: q.status,
        from: q.from ? new Date(q.from) : undefined,
        to: q.to ? new Date(q.to) : undefined,
        eventType: q.eventType,
      });
    },
  );

  app.post(
    '/vehicles/:id/events',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['events'],
        summary: 'Create vehicle event',
        security: [{ bearerAuth: [] }],
        params: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } }, required: ['id'] },
        body: {
          type: 'object',
          required: ['eventType', 'dueDate'],
          properties: { eventType: { type: 'string', enum: ['insurance', 'inspection', 'iuc', 'custom'] }, dueDate: { type: 'string', format: 'date' }, note: { type: 'string' } },
        },
        response: { 201: { type: 'object', required: ['id'], properties: { id: { type: 'number' } } } },
      },
    },
    async (req: any, reply) => {
      const userId = Number(req.user.sub);
      const { id: vehicleId } = idParam.parse(req.params);
      const body = z.object({ eventType: eventTypeEnum, dueDate: z.coerce.date(), note: z.string().optional() }).parse(req.body);

      const result = await svcCreateForVehicle(userId, vehicleId, body);
      return reply.code(201).send(result);
    },
  );

  app.patch(
    '/events/:id',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['events'],
        summary: 'Update vehicle event',
        security: [{ bearerAuth: [] }],
        params: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } }, required: ['id'] },
        body: {
          type: 'object',
          properties: {
            isDone: { type: 'boolean' },
            doneDate: { type: 'string', format: 'date' },
            note: { type: 'string' },
            expense: {
              type: 'object',
              properties: {
                expenseDate: { type: 'string', format: 'date' },
                amountEur: { type: 'string' },
              category: { type: 'string', enum: ['part','event','insurance','inspection','iuc','custom'] },
                description: { type: 'string' },
                vendor: { type: 'string' },
              },
            },
          },
        },
        response: { 200: { type: 'object', required: ['id'], properties: { id: { type: 'number' } } } },
      },
    },
    async (req: any) => {
      const userId = Number(req.user.sub);
      const { id } = idParam.parse(req.params);
      const data = z
        .object({
          isDone: z.boolean().optional(),
          doneDate: z.coerce.date().optional(),
          note: z.string().optional(),
          expense: z
            .object({
              expenseDate: z.coerce.date().optional(),
              amountEur: z.string(),
              category: z.enum(['part','event','insurance','inspection','iuc']),
              description: z.string().optional(),
              vendor: z.string().optional(),
            })
            .optional(),
        })
        .parse(req.body);
      return svcUpdateEvent(userId, id, data as any);
    },
  );
}
