import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../db/prisma';
import { AppError } from '../errors';

const categoryEnum = z.enum(['part','event','insurance','inspection','iuc','maintenance','service','fuel','toll','parking','other']);

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
          properties: { vehicleId: { type: 'integer', minimum: 1 }, from: { type: 'string', format: 'date' }, to: { type: 'string', format: 'date' }, category: { type: 'string', enum: ['part','event','insurance','inspection','iuc','maintenance','service','fuel','toll','parking','other'] } },
        },
        response: { 200: { type: 'object', required: ['data'], properties: { data: { type: 'array', items: { type: 'object' } } } } },
      },
    },
    async (req: any) => {
      const userId = Number(req.user.sub);
      const { vehicleId, from, to, category } = req.query as any;

      const whereDate = from || to ? { expenseDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {};
      const whereCategory = category ? { category } : {};

      const whereVehicle = vehicleId
        ? {
            OR: [
              { vehicleEvent: { vehicleId, vehicle: { userId } } },
              { trackedItem: { vehicleId, vehicle: { userId } } },
            ],
          }
        : {
            OR: [
              { vehicleEvent: { vehicle: { userId } } },
              { trackedItem: { vehicle: { userId } } },
            ],
          };

      const data = await prisma.expense.findMany({ where: { ...whereVehicle, ...whereDate, ...whereCategory }, orderBy: { expenseDate: 'desc' } });
      return { data };
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
          type: 'object',
          required: ['expenseDate', 'amountEur', 'category'],
          properties: {
            trackedItemId: { type: 'integer', minimum: 1 },
            vehicleEventId: { type: 'integer', minimum: 1 },
            expenseDate: { type: 'string', format: 'date' },
            amountEur: { type: 'string' },
            category: { type: 'string', enum: ['part','event','insurance','inspection','iuc','maintenance','service','fuel','toll','parking','other'] },
            description: { type: 'string' },
            vendor: { type: 'string' },
          },
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

      const hasTI = !!body.trackedItemId;
      const hasVE = !!body.vehicleEventId;
      if (hasTI === hasVE) throw new AppError('Exactly one of trackedItemId or vehicleEventId is required', 400);

      if (hasTI) {
        const ti = await prisma.trackedItem.findFirst({ where: { id: body.trackedItemId!, vehicle: { userId } } });
        if (!ti) throw new AppError('Not found', 404);
      }
      if (hasVE) {
        const ve = await prisma.vehicleEvent.findFirst({ where: { id: body.vehicleEventId!, vehicle: { userId } } });
        if (!ve) throw new AppError('Not found', 404);
      }

      const created = await prisma.expense.create({
        data: {
          trackedItemId: body.trackedItemId,
          vehicleEventId: body.vehicleEventId,
          expenseDate: body.expenseDate,
          amountEur: body.amountEur as any,
          category: body.category,
          description: body.description,
          vendor: body.vendor,
        },
      });
      return reply.code(201).send({ id: created.id });
    },
  );
}

