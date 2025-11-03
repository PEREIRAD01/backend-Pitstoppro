/// <reference types="vitest/globals" />
import { beforeEach, describe, expect, it, vi } from 'vitest';
import dashboard from '../../src/routes/dashboard';

const { mockVehicleEventFindMany, mockTrackedItemFindMany } = vi.hoisted(() => ({
  mockVehicleEventFindMany: vi.fn(),
  mockTrackedItemFindMany: vi.fn(),
}));

vi.mock('../../src/db/prisma', () => ({
  default: {
    vehicleEvent: { findMany: mockVehicleEventFindMany },
    trackedItem: { findMany: mockTrackedItemFindMany },
  },
}));

describe('dashboard summary route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('returns overdue flags and respects limit filtering', async () => {
    const now = new Date(2024, 5, 10, 12);
    vi.useFakeTimers().setSystemTime(now);

    mockVehicleEventFindMany.mockResolvedValueOnce([
      { id: 1, dueDate: new Date(2024, 5, 12), vehicle: { id: 11 } },
      { id: 2, dueDate: new Date(2024, 5, 9), vehicle: { id: 11 } },
    ]);

    mockTrackedItemFindMany
      .mockResolvedValueOnce([
        { id: 3, dueDate: new Date(2024, 5, 8), vehicle: { id: 11 } },
      ])
      .mockResolvedValueOnce([
        { id: 4, dueDate: null, vehicle: { id: 11 } },
      ]);

    let capturedHandler: any;
    const fakeApp: any = {
      authenticate: vi.fn(),
      get(_path: string, _opts: any, handler: any) {
        capturedHandler = handler;
      },
    };

    await dashboard(fakeApp);

    const result = await capturedHandler({
      user: { sub: '7' },
      query: { limit: '2' },
    });

    expect(mockVehicleEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ vehicle: { userId: 7 }, isDone: false }),
        take: 2,
      }),
    );

    expect(mockTrackedItemFindMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { vehicle: { userId: 7 }, isDone: false, dueDate: { not: null } },
        take: 2,
      }),
    );
    expect(mockTrackedItemFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        take: 1,
      }),
    );

    expect(result.upcomingEvents).toHaveLength(2);
    const overdueEvent = result.upcomingEvents.find((e: any) => e.id === 2);
    expect(overdueEvent.isOverdue).toBe(true);
    expect(overdueEvent.daysOverdue).toBe(1);

    const futureEvent = result.upcomingEvents.find((e: any) => e.id === 1);
    expect(futureEvent.isOverdue).toBe(false);
    expect(futureEvent.daysOverdue).toBe(0);

    expect(result.pendingTrackedItems).toHaveLength(2);
    const overdueTracked = result.pendingTrackedItems.find((t: any) => t.id === 3);
    expect(overdueTracked.isOverdue).toBe(true);
    expect(overdueTracked.daysOverdue).toBe(2);

    const noDue = result.pendingTrackedItems.find((t: any) => t.id === 4);
    expect(noDue.isOverdue).toBe(false);
    expect(noDue.daysOverdue).toBe(0);

    vi.useRealTimers();
  });
});
