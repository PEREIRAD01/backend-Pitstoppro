#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'mysql://pituser:pitpass@127.0.0.1:3307/pitstop_test';
}

const result = spawnSync('npx', ['prisma', 'db', 'push'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
