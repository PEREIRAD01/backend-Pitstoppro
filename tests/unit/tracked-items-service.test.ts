/// <reference types="vitest/globals" />
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateItem, createLog } from '../../src/services/tracked-items-service';
import {
  findOwnedItem,
  updateItemRecord,
  createLogRecord,
} from '../../src/repos/tracked-item-repo';
import { createExpense } from '../../src/services/expenses-service';

vi.mock('../../src/repos/tracked-item-repo', () => ({
  findVehicleOwned: vi.fn(),
  listByVehicle: vi.fn(),
  createItem: vi.fn(),
  updateItemRecord: vi.fn(),
  findOwnedItem: vi.fn(),
  createLogRecord: vi.fn(),
  listLogsByItem: vi.fn(),
}));

vi.mock('../../src/services/expenses-service', () => ({
  createExpense: vi.fn(),
}));

const baseItem = {
  id: 55,
  vehicle: { userId: 9 },
};

describe('tracked-items-service updateItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects with 404 when item is not owned by user', async () => {
    vi.mocked(findOwnedItem).mockResolvedValueOnce(null as any);

    await expect(updateItem(9, 55, { note: 'x' })).rejects.toMatchObject({ status: 404 });
    expect(updateItemRecord).not.toHaveBeenCalled();
  });

  it('clears doneDate when isDone is set to false', async () => {
    vi.mocked(findOwnedItem).mockResolvedValueOnce(baseItem as any);
    vi.mocked(updateItemRecord).mockResolvedValueOnce({ id: 55 } as any);

    const result = await updateItem(9, 55, { isDone: false, doneDate: new Date('2024-01-01') });

    expect(updateItemRecord).toHaveBeenCalledWith(55, { isDone: false, doneDate: null });
    expect(result).toEqual({ id: 55 });
  });
});

describe('tracked-items-service createLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects with 404 when item is not owned by user', async () => {
    vi.mocked(findOwnedItem).mockResolvedValueOnce(null as any);

    await expect(
      createLog(9, 55, { logDate: new Date('2024-02-01') }),
    ).rejects.toMatchObject({ status: 404 });
    expect(createLogRecord).not.toHaveBeenCalled();
    expect(createExpense).not.toHaveBeenCalled();
  });

  it('creates expense inline with provided expenseDate', async () => {
    const logDate = new Date('2024-02-01');
    const expenseDate = new Date('2024-02-02');
    vi.mocked(findOwnedItem).mockResolvedValueOnce(baseItem as any);
    vi.mocked(createLogRecord).mockResolvedValueOnce({ id: 77 } as any);

    await createLog(9, 55, {
      logDate,
      expense: {
        expenseDate,
        amountEur: '30.00',
        category: 'part',
        description: 'oil',
      },
    } as any);

    expect(createExpense).toHaveBeenCalledWith(9, {
      trackedItemId: 55,
      expenseDate,
      amountEur: '30.00',
      category: 'part',
      description: 'oil',
      vendor: undefined,
    });
  });

  it('falls back to logDate when expenseDate is missing', async () => {
    const logDate = new Date('2024-02-10');
    vi.mocked(findOwnedItem).mockResolvedValueOnce(baseItem as any);
    vi.mocked(createLogRecord).mockResolvedValueOnce({ id: 78 } as any);

    await createLog(9, 55, {
      logDate,
      expense: {
        amountEur: '18.90',
        category: 'event',
      },
    } as any);

    expect(createExpense).toHaveBeenCalledWith(9, {
      trackedItemId: 55,
      expenseDate: logDate,
      amountEur: '18.90',
      category: 'event',
      description: undefined,
      vendor: undefined,
    });
  });

  it('does not create expense when required fields are missing', async () => {
    const logDate = new Date('2024-03-01');
    vi.mocked(findOwnedItem).mockResolvedValueOnce(baseItem as any);
    vi.mocked(createLogRecord).mockResolvedValueOnce({ id: 79 } as any);

    await createLog(9, 55, {
      logDate,
      expense: {
        amountEur: '',
        category: 'part',
      },
    } as any);

    expect(createExpense).not.toHaveBeenCalled();
  });
});
