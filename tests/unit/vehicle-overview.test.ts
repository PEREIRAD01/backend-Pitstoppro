/// <reference types="vitest/globals" />
import { beforeEach, describe, expect, it, vi } from 'vitest';
import vehicles from '../../src/routes/vehicles';
import { AppError } from '../../src/errors';

const { mockVehicleFindFirst, mockVehicleEventFindMany, mockTrackedItemFindMany, mockExpenseFindMany } = vi.hoisted(() => ({
  mockVehicleFindFirst: vi.fn(),
  mockVehicleEventFindMany: vi.fn(),
  mockTrackedItemFindMany: vi.fn(),
  mockExpenseFindMany: vi.fn(),
}));

vi.mock('../../src/db/prisma', () => ({
  default: {
    vehicle: { findFirst: mockVehicleFindFirst, update: vi.fn() },
    vehicleEvent: { findMany: mockVehicleEventFindMany },
    trackedItem: { findMany: mockTrackedItemFindMany },
    expense: { findMany: mockExpenseFindMany },
  },
}));

describe('vehicles route overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  const buildApp = () => {
    let overviewHandler: any;
    const app: any = {
      authenticate: vi.fn(),
      get(path: string, _opts: any, handler: any) {
        if (path === '/vehicles/:id/overview') overviewHandler = handler;
      },
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      register: vi.fn(),
    };
    return { app, getOverview: () => overviewHandler };
  };

  it('throws 404 when vehicle not found', async () => {
    mockVehicleFindFirst.mockResolvedValueOnce(null);

    const { app, getOverview } = buildApp();
    await vehicles(app);

    const handler = getOverview();
    await expect(
      handler({
        user: { sub: '5' },
        params: { id: '10' },
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('returns vehicle overview with overdue calculations and hasPhoto flag', async () => {
    const now = new Date(2024, 5, 10, 9);
    vi.useFakeTimers().setSystemTime(now);

    mockVehicleFindFirst.mockResolvedValueOnce({
      id: 10,
      userId: 5,
      plate: 'AA-00-AA',
      brand: 'Tesla',
      model: 'Model 3',
      year: 2022,
      vehicleName: 'Daily',
      currentOdometerKm: 12345,
      photoBytes: Buffer.from('img'),
    });

    mockVehicleEventFindMany.mockResolvedValueOnce([
      { id: 1, dueDate: new Date(2024, 5, 9), isDone: false },
      { id: 2, dueDate: new Date(2024, 5, 12), isDone: false },
    ]);

    mockTrackedItemFindMany
      .mockResolvedValueOnce([
        { id: 3, dueDate: new Date(2024, 5, 8), isDone: false },
      ])
      .mockResolvedValueOnce([
        { id: 4, dueDate: null, isDone: false },
      ]);

    mockExpenseFindMany.mockResolvedValueOnce([
      { id: 7, expenseDate: new Date(2024, 5, 1), amountEur: '50.00' },
    ]);

    const { app, getOverview } = buildApp();
    await vehicles(app);

    const handler = getOverview();
    const result = await handler({
      user: { sub: '5' },
      params: { id: '10' },
    });

    expect(result.vehicle).toMatchObject({
      id: 10,
      plate: 'AA-00-AA',
      brand: 'Tesla',
      model: 'Model 3',
      year: 2022,
      vehicleName: 'Daily',
      currentOdometerKm: 12345,
    });
    expect(result.hasPhoto).toBe(true);

    const overdueEvent = result.upcomingEvents.find((e: any) => e.id === 1);
    expect(overdueEvent.isOverdue).toBe(true);
    expect(overdueEvent.daysOverdue).toBe(1);

    const upcomingEvent = result.upcomingEvents.find((e: any) => e.id === 2);
    expect(upcomingEvent.isOverdue).toBe(false);
    expect(upcomingEvent.daysOverdue).toBe(0);

    const overdueTracked = result.pendingTrackedItems.find((t: any) => t.id === 3);
    expect(overdueTracked.isOverdue).toBe(true);
    expect(overdueTracked.daysOverdue).toBe(2);

    const pendingNoDue = result.pendingTrackedItems.find((t: any) => t.id === 4);
    expect(pendingNoDue.isOverdue).toBe(false);
    expect(pendingNoDue.daysOverdue).toBe(0);

    expect(result.recentExpenses).toEqual([{ id: 7, expenseDate: new Date(2024, 5, 1), amountEur: '50.00' }]);

    expect(mockExpenseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { vehicleEvent: { vehicleId: 10, vehicle: { userId: 5 } } },
            { trackedItem: { vehicleId: 10, vehicle: { userId: 5 } } },
          ],
        },
        take: 5,
      }),
    );

    vi.useRealTimers();
  });
});
