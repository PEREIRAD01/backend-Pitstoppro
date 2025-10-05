import { buildApp } from './app.js';

const app = buildApp();
const port = 3333;

app.listen({ port, host: '0.0.0.0' });
