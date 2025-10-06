import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	PORT: z.coerce.number().default(3333),

	JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
	DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

	SHADOW_DATABASE_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
	console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
	process.exit(1);
}

export const env = parsed.data;
