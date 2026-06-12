import { AppError } from '../errors';
import { createExpense } from './expenses-service';
import type { ExpenseCategory } from '../repos/expense-repo';
import {
  findVehicleOwned,
  listByVehicle,
  createItem,
  updateItemRecord,
  findOwnedItem,
  createLogRecord,
  listLogsByItem,
  CreateTrackedItemInput,
  UpdateTrackedItemInput,
  CreateLogInput,
} from '../repos/tracked-item-repo';

type ListFilters = { type?: 'event' | 'part'; status?: 'pending' | 'done' };

export async function listForVehicle(userId: number, vehicleId: number, filters: ListFilters) {
  const vehicle = await findVehicleOwned(vehicleId, userId);
  if (!vehicle) throw new AppError('Not found', 404);

  const where: any = {};
  if (filters.type) where.itemType = filters.type;
  if (filters.status === 'pending') where.isDone = false;
  if (filters.status === 'done') where.isDone = true;

  const items = await listByVehicle(vehicleId, where);
  return { data: items };
}

export async function createForVehicle(userId: number, vehicleId: number, input: CreateTrackedItemInput) {
  const vehicle = await findVehicleOwned(vehicleId, userId);
  if (!vehicle) throw new AppError('Not found', 404);
  const created = await createItem(vehicleId, input);
  return { id: created.id };
}

export async function updateItem(userId: number, id: number, data: UpdateTrackedItemInput) {
  const item = await findOwnedItem(id);
  if (!item || item.vehicle.userId !== userId) throw new AppError('Not found', 404);

  const payload: UpdateTrackedItemInput = { ...data };
  if (payload.isDone === false) payload.doneDate = null;

  const updated = await updateItemRecord(id, payload);
  return { id: updated.id };
}

type ExpenseInlineInput = {
  expenseDate?: Date;
  amountEur: string;
  category: ExpenseCategory;
  description?: string;
  vendor?: string;
};

export async function createLog(
  userId: number,
  id: number,
  input: CreateLogInput & { expense?: ExpenseInlineInput },
) {
  const item = await findOwnedItem(id);
  if (!item || item.vehicle.userId !== userId) throw new AppError('Not found', 404);
  const created = await createLogRecord(id, input);

  if (input.expense && input.expense.amountEur && input.expense.category) {
    const expenseDate = input.expense.expenseDate ?? input.logDate;
    await createExpense(userId, {
      trackedItemId: id,
      expenseDate,
      amountEur: input.expense.amountEur,
      category: input.expense.category,
      description: input.expense.description,
      vendor: input.expense.vendor,
    });
  }

  return { id: created.id };
}

export async function listLogs(userId: number, id: number) {
  const item = await findOwnedItem(id);
  if (!item || item.vehicle.userId !== userId) throw new AppError('Not found', 404);
  const logs = await listLogsByItem(id);
  return { data: logs };
}

