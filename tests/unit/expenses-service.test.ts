/// <reference types="vitest/globals" />
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createExpense } from '../../src/services/expenses-service';
import { AppError } from '../../src/errors';
import {
  createExpenseRecord,
  findTrackedItemOwned,
  findVehicleEventOwned,
  findExpenseDuplicateForTI,
  findExpenseDuplicateForVE,
} from '../../src/repos/expense-repo';

vi.mock('../../src/repos/expense-repo', () => ({
  listExpensesForUser: vi.fn(),
  findTrackedItemOwned: vi.fn(),
  findVehicleEventOwned: vi.fn(),
  createExpenseRecord: vi.fn(),
  findExpenseDuplicateForTI: vi.fn(),
  findExpenseDuplicateForVE: vi.fn(),
}));

const trackedInput = {
  trackedItemId: 10,
  expenseDate: new Date('2024-05-05'),
  amountEur: '123.45',
  category: 'part' as const,
};

const eventInput = {
  vehicleEventId: 22,
  expenseDate: new Date('2024-06-10'),
  amountEur: '89.00',
  category: 'event' as const,
};

describe('createExpense service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when both trackedItemId and vehicleEventId are provided', async () => {
    await expect(
      createExpense(1, {
        trackedItemId: 5,
        vehicleEventId: 6,
        expenseDate: new Date('2024-01-01'),
        amountEur: '10.00',
        category: 'event',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects with 404 when tracked item is not owned by user', async () => {
    vi.mocked(findTrackedItemOwned).mockResolvedValueOnce(null);

    await expect(createExpense(7, trackedInput)).rejects.toMatchObject({ status: 404 });
    expect(findTrackedItemOwned).toHaveBeenCalledWith(trackedInput.trackedItemId, 7);
    expect(createExpenseRecord).not.toHaveBeenCalled();
  });

  it('returns existing expense id when duplicate found for tracked item', async () => {
    vi.mocked(findTrackedItemOwned).mockResolvedValueOnce({ id: trackedInput.trackedItemId });
    vi.mocked(findExpenseDuplicateForTI).mockResolvedValueOnce({ id: 33 });

    const result = await createExpense(3, trackedInput);

    expect(result).toEqual({ id: 33 });
    expect(createExpenseRecord).not.toHaveBeenCalled();
  });

  it('creates new expense when vehicle event is valid and not duplicated', async () => {
    vi.mocked(findTrackedItemOwned).mockResolvedValue(null);
    vi.mocked(findVehicleEventOwned).mockResolvedValueOnce({ id: eventInput.vehicleEventId });
    vi.mocked(findExpenseDuplicateForVE).mockResolvedValueOnce(null);
    vi.mocked(createExpenseRecord).mockResolvedValueOnce({ id: 88 });

    const result = await createExpense(4, eventInput);

    expect(findVehicleEventOwned).toHaveBeenCalledWith(eventInput.vehicleEventId, 4);
    expect(findExpenseDuplicateForVE).toHaveBeenCalledWith(
      eventInput.vehicleEventId,
      eventInput.expenseDate,
      eventInput.amountEur,
    );
    expect(createExpenseRecord).toHaveBeenCalledWith(eventInput);
    expect(result).toEqual({ id: 88 });
  });
});
