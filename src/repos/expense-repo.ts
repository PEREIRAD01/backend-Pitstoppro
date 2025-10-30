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
  filters: { vehicleId?: number; from?: Date; to?: Date; category?: ExpenseCategory },
) {
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

  const data = await prisma.expense.findMany({
    where: { ...whereVehicle, ...whereDate, ...whereCategory },
    orderBy: { expenseDate: 'desc' },
  });
  return { data };
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
      amountEur: input.amountEur as any,
      category: input.category as any,
      description: input.description,
      vendor: input.vendor,
    },
  });
}
