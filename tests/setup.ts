import fs from 'node:fs';
import dotenv from 'dotenv';

dotenv.config();

if (fs.existsSync('.env.test')) {
  dotenv.config({ path: '.env.test', override: true });
}
