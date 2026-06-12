import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';

export type ExpenseCategory = 'part' | 'event' | 'insurance' | 'inspection' | 'iuc' | 'custom';

export type CreateExpenseInput = {
  trackedItemId?: number;
  vehicleEventId?: number;
  expenseDate: Date;
  amountEur: string; // keep as string to match route input; Prisma Decimal cast in service/repo
  category: ExpenseCategory;
  description?: string | null;
  vendor?: string | null;
};

export async function listExpensesForUser(
  userId: number,
  filters: { vehicleId?: number; from?: Date; to?: Date; category?: ExpenseCategory; page?: number; limit?: number },
) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const whereDate = filters.from || filters.to
    ? { expenseDate: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
    : {};
  const whereCategory = filters.category ? { category: filters.category } : {};

  const whereVehicle = filters.vehicleId
    ? {
        OR: [
          { vehicleEvent: { vehicleId: filters.vehicleId, vehicle: { userId } } },
          { trackedItem: { vehicleId: filters.vehicleId, vehicle: { userId } } },
        ],
      }
    : {
        OR: [
          { vehicleEvent: { vehicle: { userId } } },
          { trackedItem: { vehicle: { userId } } },
        ],
      };

  const where = { ...whereVehicle, ...whereDate, ...whereCategory };

  const [data, total] = await prisma.$transaction([
    prisma.expense.findMany({ where, orderBy: { expenseDate: 'desc' }, skip, take: limit }),
    prisma.expense.count({ where }),
  ]);

  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function findTrackedItemOwned(id: number, userId: number) {
  return prisma.trackedItem.findFirst({ where: { id, vehicle: { userId } }, select: { id: true } });
}

export async function findVehicleEventOwned(id: number, userId: number) {
  return prisma.vehicleEvent.findFirst({ where: { id, vehicle: { userId } }, select: { id: true } });
}

export async function createExpenseRecord(input: CreateExpenseInput) {
  return prisma.expense.create({
    data: {
      trackedItemId: input.trackedItemId,
      vehicleEventId: input.vehicleEventId,
      expenseDate: input.expenseDate,
      amountEur: new Prisma.Decimal(input.amountEur),
      category: input.category as any,
      description: input.description,
      vendor: input.vendor,
    },
  });
}

export async function findExpenseDuplicateForTI(trackedItemId: number, expenseDate: Date, amountEur: string) {
  return prisma.expense.findFirst({
    where: { trackedItemId, expenseDate, amountEur: new Prisma.Decimal(amountEur) },
    select: { id: true },
  });
}

export async function findExpenseDuplicateForVE(vehicleEventId: number, expenseDate: Date, amountEur: string) {
  return prisma.expense.findFirst({
    where: { vehicleEventId, expenseDate, amountEur: new Prisma.Decimal(amountEur) },
    select: { id: true },
  });
}
