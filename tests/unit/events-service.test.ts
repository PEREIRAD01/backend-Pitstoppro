/// <reference types="vitest/globals" />
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateEvent } from '../../src/services/events-service';
import { AppError } from '../../src/errors';
import {
  findOwnedEvent,
  updateEventRecord,
} from '../../src/repos/event-repo';
import { createExpense } from '../../src/services/expenses-service';

vi.mock('../../src/repos/event-repo', () => ({
  findVehicleOwned: vi.fn(),
  listEventsByVehicle: vi.fn(),
  createEvent: vi.fn(),
  findOwnedEvent: vi.fn(),
  updateEventRecord: vi.fn(),
}));

vi.mock('../../src/services/expenses-service', () => ({
  createExpense: vi.fn(),
}));

const baseEvent = {
  id: 42,
  vehicle: { userId: 7 },
};

describe('events-service updateEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects with 404 when event is not owned by user', async () => {
    vi.mocked(findOwnedEvent).mockResolvedValueOnce(null as any);

    await expect(
      updateEvent(7, 42, { note: 'x' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(updateEventRecord).not.toHaveBeenCalled();
  });

  it('clears doneDate when isDone is set to false', async () => {
    vi.mocked(findOwnedEvent).mockResolvedValueOnce(baseEvent as any);
    vi.mocked(updateEventRecord).mockResolvedValueOnce({ id: 42 } as any);

    const result = await updateEvent(7, 42, {
      isDone: false,
      doneDate: new Date('2024-03-01'),
    });

    expect(updateEventRecord).toHaveBeenCalledWith(42, {
      isDone: false,
      doneDate: null,
    });
    expect(createExpense).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 42 });
  });

  it('creates expense inline using doneDate when provided', async () => {
    const doneDate = new Date('2024-05-15');
    vi.mocked(findOwnedEvent).mockResolvedValueOnce(baseEvent as any);
    vi.mocked(updateEventRecord).mockResolvedValueOnce({ id: 42 } as any);

    await updateEvent(7, 42, {
      isDone: true,
      doneDate,
      expense: {
        amountEur: '123.50',
        category: 'inspection',
        description: 'IPO',
      },
    } as any);

    expect(createExpense).toHaveBeenCalledWith(7, {
      vehicleEventId: 42,
      expenseDate: doneDate,
      amountEur: '123.50',
      category: 'inspection',
      description: 'IPO',
      vendor: undefined,
    });
  });
});
