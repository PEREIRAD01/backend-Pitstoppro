import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../db/prisma';
import { AppError } from '../errors';

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

      const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, userId }, select: { id: true } });
      if (!vehicle) throw new AppError('Not found', 404);

      const { status, from, to, eventType } = req.query as any;
      const where: any = { vehicleId };
      if (status === 'pending') where.isDone = false;
      if (status === 'done') where.isDone = true;
      if (from || to) where.dueDate = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
      if (eventType) where.eventType = eventType;

      const items = await prisma.vehicleEvent.findMany({ where, orderBy: { dueDate: 'asc' } });
      return items;
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

      const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, userId }, select: { id: true } });
      if (!vehicle) throw new AppError('Not found', 404);

      const created = await prisma.vehicleEvent.create({ data: { vehicleId, eventType: body.eventType, dueDate: body.dueDate, note: body.note } });
      return reply.code(201).send({ id: created.id });
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
        body: { type: 'object', properties: { isDone: { type: 'boolean' }, doneDate: { type: 'string', format: 'date' }, note: { type: 'string' } } },
        response: { 200: { type: 'object', required: ['id'], properties: { id: { type: 'number' } } } },
      },
    },
    async (req: any) => {
      const userId = Number(req.user.sub);
      const { id } = idParam.parse(req.params);
      const data = z.object({ isDone: z.boolean().optional(), doneDate: z.coerce.date().optional(), note: z.string().optional() }).parse(req.body);

      const event = await prisma.vehicleEvent.findFirst({ where: { id }, include: { vehicle: true } });
      if (!event || event.vehicle.userId !== userId) throw new AppError('Not found', 404);

      // Regra: se isDone=false, limpar sempre doneDate
      const payload: any = { ...data };
      if (payload.isDone === false) payload.doneDate = null;

      const updated = await prisma.vehicleEvent.update({ where: { id }, data: payload });
      return { id: updated.id };
    },
  );
}
