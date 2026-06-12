/// <reference types="vitest/globals" />
import { buildApp } from '../src/app';

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

function uniqueEmail() {
  return `daniel.test+${Date.now()}@test.com`;
}

test('register -> token, then me works', async () => {
  const email = uniqueEmail();

  const register = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password: '12345678', displayName: 'Daniel' },
  });
  expect(register.statusCode).toBe(201);
  const token = register.json().token as string;
  expect(typeof token).toBe('string');

  const me = await app.inject({
    method: 'GET',
    url: '/v1/auth/me',
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(me.statusCode).toBe(200);
  expect(me.json().email).toBe(email.toLowerCase());
});

test('login with correct credentials returns token', async () => {
  const email = uniqueEmail();
  await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password: '12345678', displayName: 'Daniel' },
  });

  const login = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password: '12345678' },
  });
  expect(login.statusCode).toBe(200);
  expect(typeof login.json().token).toBe('string');
});
