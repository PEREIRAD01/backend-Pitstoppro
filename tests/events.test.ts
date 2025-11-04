/// <reference types="vitest/globals" />
import { buildApp } from '../src/app';

let app: Awaited<ReturnType<typeof buildApp>>;
let token: string;

beforeAll(async () => {
  app = await buildApp();
  const email = `event.tester+${Date.now()}@test.com`;
  const reg = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password: '12345678', displayName: 'Event Tester' },
  });
  token = reg.json().token as string;
});

afterAll(async () => {
  await app.close();
});

test('events lifecycle creates expenses inline when completing an event', async () => {
  const vehiclePlate = `EV-${Math.floor(Math.random() * 900 + 100)}-ZZ`;
  const createVehicle = await app.inject({
    method: 'POST',
    url: '/v1/vehicles',
    headers: { Authorization: `Bearer ${token}` },
    payload: { plate: vehiclePlate, brand: 'BMW', model: 'R nineT' },
  });
  expect(createVehicle.statusCode).toBe(201);
  const vehicleId = createVehicle.json().id as number;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);

  const createEvent = await app.inject({
    method: 'POST',
    url: `/v1/vehicles/${vehicleId}/events`,
    headers: { Authorization: `Bearer ${token}` },
    payload: { eventType: 'inspection', dueDate: dueDate.toISOString().substring(0, 10), note: 'IPO anual' },
  });
  expect(createEvent.statusCode).toBe(201);
  const eventId = createEvent.json().id as number;

  const listPending = await app.inject({
    method: 'GET',
    url: `/v1/vehicles/${vehicleId}/events`,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(listPending.statusCode).toBe(200);
  const pendingBody = listPending.json() as any[];
  expect(pendingBody.some(ev => ev.id === eventId && ev.isDone === false)).toBe(true);

  const doneDate = new Date();
  doneDate.setDate(doneDate.getDate() + 8);

  const patchEvent = await app.inject({
    method: 'PATCH',
    url: `/v1/events/${eventId}`,
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      isDone: true,
      doneDate: doneDate.toISOString().substring(0, 10),
      note: 'IPO concluída',
      expense: {
        amountEur: '110.50',
        category: 'inspection',
        description: 'Taxa IPO',
      },
    },
  });
  expect(patchEvent.statusCode).toBe(200);

  const listDone = await app.inject({
    method: 'GET',
    url: `/v1/vehicles/${vehicleId}/events?status=done`,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(listDone.statusCode).toBe(200);
  const doneBody = listDone.json() as any[];
  expect(doneBody.some(ev => ev.id === eventId && ev.isDone === true)).toBe(true);

  const expenses = await app.inject({
    method: 'GET',
    url: `/v1/expenses?vehicleId=${vehicleId}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(expenses.statusCode).toBe(200);
  const expensesBody = expenses.json().data as any[];
  const createdExpense = expensesBody.find(exp => exp.vehicleEventId === eventId);
  expect(createdExpense).toBeDefined();
  expect(Number(createdExpense.amountEur)).toBeCloseTo(110.5);
  expect(createdExpense.category).toBe('inspection');
});
