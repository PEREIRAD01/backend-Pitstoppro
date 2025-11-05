/// <reference types="vitest/globals" />
import { buildApp } from '../src/app';
import prisma from '../src/db/prisma';

let app: Awaited<ReturnType<typeof buildApp>>;
let token: string;

beforeAll(async () => {
  app = await buildApp();
  const email = `overview.tester+${Date.now()}@test.com`;
  const reg = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password: '12345678', displayName: 'Overview Tester' },
  });
  token = reg.json().token as string;
});

afterAll(async () => {
  await app.close();
});

test('vehicle overview returns vehicle details, overdue flags and recent expenses', async () => {
  const plate = `OV-${Math.floor(Math.random() * 900 + 100)}-ZZ`;
  const vehicleResp = await app.inject({
    method: 'POST',
    url: '/v1/vehicles',
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      plate,
      brand: 'Kawasaki',
      model: 'Z650',
      vehicleName: 'Daily Ride',
      currentOdometerKm: 12340,
    },
  });
  expect(vehicleResp.statusCode).toBe(201);
  const vehicleId = vehicleResp.json().id as number;

  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { photoBytes: Buffer.from('fake-image-bytes'), photoMimeType: 'image/jpeg' },
  });

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const dueFuture = new Date(startOfToday);
  dueFuture.setDate(dueFuture.getDate() + 4);
  const duePast = new Date(startOfToday);
  duePast.setDate(duePast.getDate() - 3);

  const eventFuture = await app.inject({
    method: 'POST',
    url: `/v1/vehicles/${vehicleId}/events`,
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      eventType: 'insurance',
      dueDate: dueFuture.toISOString().substring(0, 10),
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
    },
  });
  expect(eventPast.statusCode).toBe(201);
  const eventPastId = eventPast.json().id as number;

  const trackedDue = await app.inject({
    method: 'POST',
    url: `/v1/vehicles/${vehicleId}/tracked-items`,
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      name: 'Chain Service',
      itemType: 'part',
      dueDate: duePast.toISOString().substring(0, 10),
    },
  });
  expect(trackedDue.statusCode).toBe(201);
  const trackedDueId = trackedDue.json().id as number;

  const trackedNoDue = await app.inject({
    method: 'POST',
    url: `/v1/vehicles/${vehicleId}/tracked-items`,
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      name: 'Brake Check',
      itemType: 'event',
    },
  });
  expect(trackedNoDue.statusCode).toBe(201);
  const trackedNoDueId = trackedNoDue.json().id as number;

  // Create expenses linked to event and tracked item
  const expenseEventResp = await app.inject({
    method: 'POST',
    url: '/v1/expenses',
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      vehicleEventId: eventFutureId,
      expenseDate: startOfToday.toISOString().substring(0, 10),
      amountEur: '89.99',
      category: 'insurance',
    },
  });
  expect(expenseEventResp.statusCode).toBe(201);

  const expenseTrackedResp = await app.inject({
    method: 'POST',
    url: '/v1/expenses',
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      trackedItemId: trackedDueId,
      expenseDate: startOfToday.toISOString().substring(0, 10),
      amountEur: '45.50',
      category: 'part',
    },
  });
  expect(expenseTrackedResp.statusCode).toBe(201);

  const overviewResp = await app.inject({
    method: 'GET',
    url: `/v1/vehicles/${vehicleId}/overview`,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(overviewResp.statusCode).toBe(200);
  const overview = overviewResp.json() as {
    vehicle: any;
    hasPhoto: boolean;
    upcomingEvents: any[];
    pendingTrackedItems: any[];
    recentExpenses: any[];
  };

  expect(overview.vehicle).toMatchObject({
    id: vehicleId,
    plate,
    brand: 'Kawasaki',
    model: 'Z650',
    vehicleName: 'Daily Ride',
    currentOdometerKm: 12340,
  });
  expect(overview.hasPhoto).toBe(true);

  const overdueEvent = overview.upcomingEvents.find(ev => ev.id === eventPastId);
  expect(overdueEvent).toBeDefined();
  expect(overdueEvent.isOverdue).toBe(true);

  const futureEvent = overview.upcomingEvents.find(ev => ev.id === eventFutureId);
  expect(futureEvent).toBeDefined();
  expect(futureEvent.isOverdue).toBe(false);

  const overdueTracked = overview.pendingTrackedItems.find(ti => ti.id === trackedDueId);
  expect(overdueTracked).toBeDefined();
  expect(overdueTracked.isOverdue).toBe(true);

  const pendingNoDue = overview.pendingTrackedItems.find(ti => ti.id === trackedNoDueId);
  expect(pendingNoDue).toBeDefined();
  expect(pendingNoDue.isOverdue).toBe(false);

  expect(overview.recentExpenses.length).toBeGreaterThanOrEqual(2);
  const eventExpense = overview.recentExpenses.find(exp => exp.vehicleEventId === eventFutureId);
  expect(eventExpense).toBeDefined();
  const trackedExpense = overview.recentExpenses.find(exp => exp.trackedItemId === trackedDueId);
  expect(trackedExpense).toBeDefined();
});
