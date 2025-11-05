/// <reference types="vitest/globals" />
import { buildApp } from '../src/app';

let app: Awaited<ReturnType<typeof buildApp>>;
let token: string;

beforeAll(async () => {
  app = await buildApp();
  const email = `dash.tester+${Date.now()}@test.com`;
  const reg = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password: '12345678', displayName: 'Dash Tester' },
  });
  token = reg.json().token as string;
});

afterAll(async () => {
  await app.close();
});

test('dashboard summary returns overdue flags and respects limit', async () => {
  const vehiclePlate = `DS-${Math.floor(Math.random() * 900 + 100)}-ZZ`;
  const createVehicle = await app.inject({
    method: 'POST',
    url: '/v1/vehicles',
    headers: { Authorization: `Bearer ${token}` },
    payload: { plate: vehiclePlate, brand: 'Yamaha', model: 'Tracer 7' },
  });
  expect(createVehicle.statusCode).toBe(201);
  const vehicleId = createVehicle.json().id as number;

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const dueFuture = new Date(startOfToday);
  dueFuture.setDate(dueFuture.getDate() + 5);

  const duePast = new Date(startOfToday);
  duePast.setDate(duePast.getDate() - 2);

  const eventFuture = await app.inject({
    method: 'POST',
    url: `/v1/vehicles/${vehicleId}/events`,
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      eventType: 'insurance',
      dueDate: dueFuture.toISOString().substring(0, 10),
      note: 'Seguro',
    },
  });
  expect(eventFuture.statusCode).toBe(201);
  const eventFutureId = eventFuture.json().id as number;

  const eventPast = await app.inject({
    method: 'POST',
    url: `/v1/vehicles/${vehicleId}/events`,
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      eventType: 'inspection',
      dueDate: duePast.toISOString().substring(0, 10),
      note: 'IPO',
    },
  });
  expect(eventPast.statusCode).toBe(201);
  const eventPastId = eventPast.json().id as number;

  const trackedPastDue = await app.inject({
    method: 'POST',
    url: `/v1/vehicles/${vehicleId}/tracked-items`,
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      name: 'Past Filter',
      itemType: 'part',
      dueDate: duePast.toISOString().substring(0, 10),
      validKm: 5000,
    },
  });
  expect(trackedPastDue.statusCode).toBe(201);
  const trackedPastId = trackedPastDue.json().id as number;

  const trackedNoDue = await app.inject({
    method: 'POST',
    url: `/v1/vehicles/${vehicleId}/tracked-items`,
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      name: 'No Due Item',
      itemType: 'event',
      notes: 'Check later',
    },
  });
  expect(trackedNoDue.statusCode).toBe(201);
  const trackedNoDueId = trackedNoDue.json().id as number;

  const summaryResp = await app.inject({
    method: 'GET',
    url: `/v1/dashboard/summary?limit=2`,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(summaryResp.statusCode).toBe(200);
  const summary = summaryResp.json() as {
    upcomingEvents: any[];
    pendingTrackedItems: any[];
  };

  expect(summary.upcomingEvents.length).toBeGreaterThanOrEqual(2);
  expect(summary.pendingTrackedItems.length).toBeGreaterThanOrEqual(2);

  const overdueEvent = summary.upcomingEvents.find(ev => ev.id === eventPastId);
  expect(overdueEvent).toBeDefined();
  expect(overdueEvent.isOverdue).toBe(true);
  const expectedEventDays = Math.floor(
    (startOfToday.getTime() - new Date(duePast).getTime()) / 86_400_000,
  );
  expect(overdueEvent.daysOverdue).toBe(expectedEventDays);

  const futureEvent = summary.upcomingEvents.find(ev => ev.id === eventFutureId);
  expect(futureEvent).toBeDefined();
  expect(futureEvent.isOverdue).toBe(false);
  expect(futureEvent.daysOverdue).toBe(0);

  const overdueTracked = summary.pendingTrackedItems.find(ti => ti.id === trackedPastId);
  expect(overdueTracked).toBeDefined();
  expect(overdueTracked.isOverdue).toBe(true);
  const expectedTrackedDays = Math.floor(
    (startOfToday.getTime() - new Date(duePast).getTime()) / 86_400_000,
  );
  expect(overdueTracked.daysOverdue).toBe(expectedTrackedDays);

  const noDueTracked = summary.pendingTrackedItems.find(ti => ti.id === trackedNoDueId);
  expect(noDueTracked).toBeDefined();
  expect(noDueTracked.isOverdue).toBe(false);
  expect(noDueTracked.daysOverdue).toBe(0);
});
