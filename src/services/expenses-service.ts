import { AppError } from '../errors';
import { hasExactlyOne } from '../lib/validators';
import { listExpensesForUser, findTrackedItemOwned, findVehicleEventOwned, createExpenseRecord, CreateExpenseInput, ExpenseCategory, findExpenseDuplicateForTI, findExpenseDuplicateForVE } from '../repos/expense-repo';

export async function listExpenses(userId: number, filters: { vehicleId?: number; from?: Date; to?: Date; category?: ExpenseCategory; page?: number; limit?: number }) {
  return listExpensesForUser(userId, filters);
}

export async function createExpense(userId: number, input: CreateExpenseInput) {
  if (!hasExactlyOne(input.trackedItemId, input.vehicleEventId)) {
    throw new AppError('Exactly one of trackedItemId or vehicleEventId is required', 400);
  }

  const hasTI = Boolean(input.trackedItemId);
  const hasVE = Boolean(input.vehicleEventId);

  if (hasTI) {
    const ti = await findTrackedItemOwned(input.trackedItemId!, userId);
    if (!ti) throw new AppError('Not found', 404);
    // Idempotência simples: evitar duplicados (mesma data+montante)
    const dup = await findExpenseDuplicateForTI(input.trackedItemId!, input.expenseDate, input.amountEur);
    if (dup) return { id: dup.id };
  }
  if (hasVE) {
    const ve = await findVehicleEventOwned(input.vehicleEventId!, userId);
    if (!ve) throw new AppError('Not found', 404);
    const dup = await findExpenseDuplicateForVE(input.vehicleEventId!, input.expenseDate, input.amountEur);
    if (dup) return { id: dup.id };
  }

  const created = await createExpenseRecord(input);
  return { id: created.id };
}
