import { AppError } from '../errors';
import { createEvent, findOwnedEvent, findVehicleOwned, listEventsByVehicle, updateEventRecord, CreateEventInput, UpdateEventInput } from '../repos/event-repo';
import { createExpense } from './expenses-service';
import type { ExpenseCategory } from '../repos/expense-repo';

type ListFilters = {
  status?: 'pending' | 'done';
  from?: Date;
  to?: Date;
  eventType?: 'insurance' | 'inspection' | 'iuc' | 'custom';
};

export async function listForVehicle(userId: number, vehicleId: number, filters: ListFilters) {
  const vehicle = await findVehicleOwned(vehicleId, userId);
  if (!vehicle) throw new AppError('Not found', 404);

  const where: any = {};
  if (filters.status === 'pending') where.isDone = false;
  if (filters.status === 'done') where.isDone = true;
  if (filters.from || filters.to) where.dueDate = {
    ...(filters.from ? { gte: filters.from } : {}),
    ...(filters.to ? { lte: filters.to } : {}),
  };
  if (filters.eventType) where.eventType = filters.eventType;

  return listEventsByVehicle(vehicleId, where);
}

export async function createForVehicle(userId: number, vehicleId: number, input: CreateEventInput) {
  const vehicle = await findVehicleOwned(vehicleId, userId);
  if (!vehicle) throw new AppError('Not found', 404);
  const created = await createEvent(vehicleId, input);
  return { id: created.id };
}

type ExpenseInlineInput = {
  expenseDate?: Date;
  amountEur: string;
  category: ExpenseCategory;
  description?: string;
  vendor?: string;
};

export async function updateEvent(
  userId: number,
  id: number,
  data: UpdateEventInput & { expense?: ExpenseInlineInput },
) {
  const event = await findOwnedEvent(id, userId);
  if (!event || event.vehicle.userId !== userId) throw new AppError('Not found', 404);

  const payload: UpdateEventInput = { ...data };
  if (payload.isDone === false) payload.doneDate = null;

  const updated = await updateEventRecord(id, payload);

  if (data.expense && data.expense.amountEur && data.expense.category) {
    const expenseDate = data.expense.expenseDate ?? (payload.doneDate ?? new Date());
    await createExpense(userId, {
      vehicleEventId: id,
      expenseDate,
      amountEur: data.expense.amountEur,
      category: data.expense.category,
      description: data.expense.description,
      vendor: data.expense.vendor,
    });
  }

  return { id: updated.id };
}
