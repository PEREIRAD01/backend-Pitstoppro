import dotenv from 'dotenv';
import { z } from 'zod';

const isVitest = 'VITEST_WORKER_ID' in process.env;
const nodeEnv = process.env.NODE_ENV ?? (isVitest ? 'test' : 'development');

if (nodeEnv === 'test') {
  dotenv.config({ path: '.env.test' });
} else {
  dotenv.config();
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).catch('production'),
  PORT: z.coerce.number().default(3333),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SHADOW_DATABASE_URL: z.string().optional(),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000,http://localhost:3333'),
});

const parsed = envSchema.safeParse({ ...process.env, NODE_ENV: nodeEnv });

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
