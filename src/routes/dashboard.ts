import { FastifyInstance } from 'fastify';
import prisma from '../db/prisma';
import { z } from 'zod';

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

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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

      const upcomingEvents = rawEvents.map((e: any) => {
        const isOverdue = e.dueDate && new Date(e.dueDate) < startOfToday;
        const daysOverdue = isOverdue ? Math.floor((startOfToday.getTime() - new Date(e.dueDate).getTime()) / 86400000) : 0;
        return { ...e, isOverdue, daysOverdue };
      });

      const pendingTrackedItems = rawTracked.map((t: any) => {
        const due = t.dueDate ? new Date(t.dueDate) : null;
        const isOverdue = due ? due < startOfToday : false;
        const daysOverdue = isOverdue && due ? Math.floor((startOfToday.getTime() - due.getTime()) / 86400000) : 0;
        return { ...t, isOverdue, daysOverdue };
      });

      return { upcomingEvents, pendingTrackedItems };
    },
  );
}
