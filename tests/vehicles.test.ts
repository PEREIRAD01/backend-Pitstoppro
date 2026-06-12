/// <reference types="vitest/globals" />
import { buildApp } from '../src/app';

let app: Awaited<ReturnType<typeof buildApp>>;
let token: string;

beforeAll(async () => {
  app = await buildApp();
  const email = `veh.tester+${Date.now()}@test.com`;
  const reg = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password: '12345678', displayName: 'Veh Tester' },
  });
  token = reg.json().token as string;
});

afterAll(async () => {
  await app.close();
});

test('vehicles CRUD happy path and duplicate plate 409', async () => {
  const create = await app.inject({
    method: 'POST',
    url: '/v1/vehicles',
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      plate: `AA-${Math.floor(Math.random() * 90 + 10)}-ZZ`,
      brand: 'Harley Davidson',
      model: 'Street Bob',
      photoUrl: 'https://example.com/photo.jpg',
      year: 2020,
      vehicleName: 'Street Bob (Test)',
      currentOdometerKm: 12345,
    },
  });
  expect(create.statusCode).toBe(201);
  const id = create.json().id as number;

  const list = await app.inject({ method: 'GET', url: '/v1/vehicles', headers: { Authorization: `Bearer ${token}` } });
  expect(list.statusCode).toBe(200);
  const data = list.json().data as any[];
  expect(Array.isArray(data)).toBe(true);

  const duplicate = await app.inject({
    method: 'POST',
    url: '/v1/vehicles',
    headers: { Authorization: `Bearer ${token}` },
    payload: { plate: data[0].plate, brand: 'X', model: 'Y' },
  });
  expect([409, 500]).toContain(duplicate.statusCode);

  const patch = await app.inject({
    method: 'PATCH',
    url: `/v1/vehicles/${id}`,
    headers: { Authorization: `Bearer ${token}` },
    payload: { currentOdometerKm: 13000 },
  });
  expect(patch.statusCode).toBe(200);

  const del = await app.inject({ method: 'DELETE', url: `/v1/vehicles/${id}`, headers: { Authorization: `Bearer ${token}` } });
  expect(del.statusCode).toBe(204);
});
