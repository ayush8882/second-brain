import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();

/** Prefer repo-root `.env`, then `src/.env` (common when colocated with Nest `src`). */
const envPaths = [join(cwd, '.env'), join(cwd, 'src', '.env')];

for (const path of envPaths) {
  if (existsSync(path)) {
    config({ path, override: true });
  }
}
