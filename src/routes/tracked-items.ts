import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../db/prisma';
import { AppError } from '../errors';
import { listForVehicle as svcListForVehicle, createForVehicle as svcCreateForVehicle, updateItem as svcUpdateItem, createLog as svcCreateLog, listLogs as svcListLogs } from '../services/tracked-items-service';

const itemTypeEnum = z.enum(['event', 'part']);

export default async function trackedItems(app: FastifyInstance) {
  const idParam = z.object({ id: z.coerce.number().int().positive() });

  app.get(
    '/vehicles/:id/tracked-items',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['tracked-items'],
        summary: 'List tracked items for a vehicle',
        security: [{ bearerAuth: [] }],
        params: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } }, required: ['id'] },
        querystring: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['event', 'part'] },
            status: { type: 'string', enum: ['pending', 'done'] },
          },
        },
        response: {
          200: {
            type: 'object',
            required: ['data'],
            properties: {
              data: {
                type: 'array',
                items: { type: 'object', additionalProperties: true },
              },
            },
          },
        },
      },
    },
    async (req: any) => {
      const userId = Number(req.user.sub);
      const { id: vehicleId } = idParam.parse(req.params);
      const q = req.query as any;
      return svcListForVehicle(userId, vehicleId, { type: q.type, status: q.status });
    },
  );

  app.post(
    '/vehicles/:id/tracked-items',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['tracked-items'],
        summary: 'Create a tracked item for a vehicle',
        security: [{ bearerAuth: [] }],
        params: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } }, required: ['id'] },
        body: {
          type: 'object',
          required: ['name', 'itemType'],
          properties: {
            name: { type: 'string' },
            itemType: { type: 'string', enum: ['event', 'part'] },
            notes: { type: 'string' },
            startDate: { type: 'string', format: 'date' },
            startOdometer: { type: 'integer' },
            validMonths: { type: 'integer' },
            validKm: { type: 'integer' },
            dueDate: { type: 'string', format: 'date' },
            dueOdometer: { type: 'integer' },
          },
        },
        response: { 201: { type: 'object', required: ['id'], properties: { id: { type: 'number' } } } },
      },
    },
    async (req: any, reply) => {
      const userId = Number(req.user.sub);
      const { id: vehicleId } = idParam.parse(req.params);

      const body = z
        .object({
          name: z.string().min(1).max(100).trim(),
          itemType: itemTypeEnum,
          notes: z.string().max(1000).trim().optional(),
          startDate: z.coerce.date().optional(),
          startOdometer: z.number().int().optional(),
          validMonths: z.number().int().optional(),
          validKm: z.number().int().optional(),
          dueDate: z.coerce.date().optional(),
          dueOdometer: z.number().int().optional(),
        })
        .parse(req.body);

      const result = await svcCreateForVehicle(userId, vehicleId, body as any);
      return reply.code(201).send(result);
    },
  );

  app.patch(
    '/tracked-items/:id',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['tracked-items'],
        summary: 'Update a tracked item',
        security: [{ bearerAuth: [] }],
        params: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } }, required: ['id'] },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            notes: { type: 'string' },
            validMonths: { type: 'integer' },
            validKm: { type: 'integer' },
            dueDate: { type: 'string', format: 'date' },
            dueOdometer: { type: 'integer' },
            isDone: { type: 'boolean' },
            doneDate: { type: 'string', format: 'date' },
            doneOdometer: { type: 'integer' },
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
          name: z.string().min(1).max(100).trim().optional(),
          notes: z.string().max(1000).trim().optional(),
          validMonths: z.number().int().optional(),
          validKm: z.number().int().optional(),
          dueDate: z.coerce.date().optional(),
          dueOdometer: z.number().int().optional(),
          isDone: z.boolean().optional(),
          doneDate: z.coerce.date().optional(),
          doneOdometer: z.number().int().optional(),
        })
        .parse(req.body);

      return svcUpdateItem(userId, id, data as any);
    },
  );

  app.post(
    '/tracked-items/:id/logs',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['tracked-items'],
        summary: 'Create a log for a tracked item',
        security: [{ bearerAuth: [] }],
        params: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } }, required: ['id'] },
        body: {
          type: 'object',
          required: ['logDate'],
          properties: {
            logDate: { type: 'string', format: 'date' },
            odometerKm: { type: 'integer' },
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
        response: { 201: { type: 'object', required: ['id'], properties: { id: { type: 'number' } } } },
      },
    },
    async (req: any, reply) => {
      const userId = Number(req.user.sub);
      const { id } = idParam.parse(req.params);
      const body = z
        .object({
          logDate: z.coerce.date(),
          odometerKm: z.number().int().optional(),
          note: z.string().max(500).trim().optional(),
          expense: z
            .object({
              expenseDate: z.coerce.date().optional(),
              amountEur: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Invalid amount format (e.g. 19.99)'),
              category: z.enum(['part','event','insurance','inspection','iuc','custom']),
              description: z.string().max(500).trim().optional(),
              vendor: z.string().max(200).trim().optional(),
            })
            .optional(),
        })
        .parse(req.body);

      const result = await svcCreateLog(userId, id, body as any);
      return reply.code(201).send(result);
    },
  );

  app.get(
    '/tracked-items/:id/logs',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['tracked-items'],
        summary: 'List logs of a tracked item',
        security: [{ bearerAuth: [] }],
        params: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } }, required: ['id'] },
        response: {
          200: {
            type: 'object',
            required: ['data'],
            properties: {
              data: {
                type: 'array',
                items: { type: 'object', additionalProperties: true },
              },
            },
          },
        },
      },
    },
    async (req: any) => {
      const userId = Number(req.user.sub);
      const { id } = idParam.parse(req.params);
      return svcListLogs(userId, id);
    },
  );

  app.delete(
    '/tracked-items/:id',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['tracked-items'],
        summary: 'Delete a tracked item',
        security: [{ bearerAuth: [] }],
        params: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } }, required: ['id'] },
        response: { 204: { type: 'null' } },
      },
    },
    async (req: any, reply) => {
      const userId = Number(req.user.sub);
      const { id } = idParam.parse(req.params);
      const item = await prisma.trackedItem.findFirst({
        where: { id, vehicle: { userId } },
      });
      if (!item) throw new AppError('Not found', 404);
      await prisma.trackedItem.delete({ where: { id } });
      return reply.status(204).send();
    },
  );
}
