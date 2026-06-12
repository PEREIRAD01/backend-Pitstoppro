import { FastifyInstance } from 'fastify';
import prisma from '../db/prisma';
import { z } from 'zod';
import { todayMidnight, calcOverdue } from '../lib/date-utils';

export default async function dashboard(app: FastifyInstance) {
  app.get(
    '/dashboard/summary',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['dashboard'],
        summary: 'Get dashboard summary for current user',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          },
        },
        response: {
          200: {
            type: 'object',
            required: ['upcomingEvents', 'pendingTrackedItems'],
            properties: {
              upcomingEvents: { type: 'array', items: { type: 'object', additionalProperties: true } },
              pendingTrackedItems: { type: 'array', items: { type: 'object', additionalProperties: true } },
            },
          },
        },
      },
    },
    async (req: any) => {
      const userId = Number(req.user.sub);

      const today = todayMidnight();

      const { limit } = z
        .object({ limit: z.coerce.number().int().min(1).max(200).default(50) })
        .parse(req.query);

      // 1) Eventos (dueDate é obrigatório): ordenados por data
      const eventsWithDue = await prisma.vehicleEvent.findMany({
        where: { vehicle: { userId }, isDone: false },
        include: { vehicle: { select: { id: true, plate: true, brand: true, model: true, vehicleName: true } } },
        orderBy: { dueDate: 'asc' },
        take: limit,
      });
      // 2) Se faltar para preencher o limite, buscar sem dueDate (vão para o fim)
      // Eventos não têm dueDate nulo pelo schema, por isso não precisamos de uma segunda query

      // 3) Tracked items com dueDate definido
      const tiWithDue = await prisma.trackedItem.findMany({
        where: { vehicle: { userId }, isDone: false, dueDate: { not: null } },
        include: { vehicle: { select: { id: true, plate: true, brand: true, model: true, vehicleName: true } } },
        orderBy: { dueDate: 'asc' },
        take: limit,
      });
      // 4) Sem dueDate
      const remainingT = Math.max(0, limit - tiWithDue.length);
      const tiNoDue =
        remainingT > 0
          ? await prisma.trackedItem.findMany({
              where: { vehicle: { userId }, isDone: false, dueDate: null },
              include: { vehicle: { select: { id: true, plate: true, brand: true, model: true, vehicleName: true } } },
              orderBy: { id: 'asc' },
              take: remainingT,
            })
          : [];

      const rawEvents = [...eventsWithDue];
      const rawTracked = [...tiWithDue, ...tiNoDue];

      const upcomingEvents = rawEvents.map((e: any) => ({ ...e, ...calcOverdue(e.dueDate, today) }));
      const pendingTrackedItems = rawTracked.map((t: any) => ({ ...t, ...calcOverdue(t.dueDate, today) }));

      return { upcomingEvents, pendingTrackedItems };
    },
  );
}
