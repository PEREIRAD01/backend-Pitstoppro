import fs from 'node:fs';
import dotenv from 'dotenv';
import { z } from 'zod';

const isVitest = 'VITEST_WORKER_ID' in process.env;
const nodeEnv = process.env.NODE_ENV ?? (isVitest ? 'test' : 'development');

dotenv.config();

if (nodeEnv === 'test') {
  const testEnvPath = '.env.test';
  if (fs.existsSync(testEnvPath)) {
    dotenv.config({ path: testEnvPath, override: true });
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default(nodeEnv as 'development' | 'test' | 'production'),
  PORT: z.coerce.number().default(3333),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SHADOW_DATABASE_URL: z.string().optional(),
});

const parsed = envSchema.safeParse({ ...process.env, NODE_ENV: nodeEnv });

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
