/// <reference types="vitest/globals" />
import { buildApp } from '../src/app';

let app: Awaited<ReturnType<typeof buildApp>>;
let token: string;

beforeAll(async () => {
  app = await buildApp();
  const email = `tracked.tester+${Date.now()}@test.com`;
  const reg = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password: '12345678', displayName: 'Tracked Tester' },
  });
  token = reg.json().token as string;
});

afterAll(async () => {
  await app.close();
});

test('tracked item log creates expense inline', async () => {
  const plate = `TI-${Math.floor(Math.random() * 900 + 100)}-ZZ`;
  const createVehicle = await app.inject({
    method: 'POST',
    url: '/v1/vehicles',
    headers: { Authorization: `Bearer ${token}` },
    payload: { plate, brand: 'Honda', model: 'CB500X' },
  });
  expect(createVehicle.statusCode).toBe(201);
  const vehicleId = createVehicle.json().id as number;

  const createItem = await app.inject({
    method: 'POST',
    url: `/v1/vehicles/${vehicleId}/tracked-items`,
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      name: 'Oil Change',
      itemType: 'part',
      dueDate: new Date().toISOString().substring(0, 10),
    },
  });
  expect(createItem.statusCode).toBe(201);
  const trackedItemId = createItem.json().id as number;

  const logDate = new Date();
  logDate.setDate(logDate.getDate() - 1);

  const createLog = await app.inject({
    method: 'POST',
    url: `/v1/tracked-items/${trackedItemId}/logs`,
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      logDate: logDate.toISOString().substring(0, 10),
      odometerKm: 15000,
      expense: {
        amountEur: '75.00',
        category: 'part',
        description: 'Oil + filter',
      },
    },
  });
  expect(createLog.statusCode).toBe(201);

  const logs = await app.inject({
    method: 'GET',
    url: `/v1/tracked-items/${trackedItemId}/logs`,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(logs.statusCode).toBe(200);
  const logsBody = logs.json().data as any[];
  expect(logsBody.some(log => log.trackedItemId === trackedItemId)).toBe(true);

  const expenses = await app.inject({
    method: 'GET',
    url: `/v1/expenses`,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(expenses.statusCode).toBe(200);
  const expensesBody = expenses.json().data as any[];
  const trackedExpense = expensesBody.find(exp => exp.trackedItemId === trackedItemId);
  expect(trackedExpense).toBeDefined();
  expect(Number(trackedExpense.amountEur)).toBeCloseTo(75);
  expect(trackedExpense.category).toBe('part');
});
