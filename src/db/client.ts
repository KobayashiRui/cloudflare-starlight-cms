import { drizzle } from 'drizzle-orm/d1';
import type { RuntimeEnv } from '../env.ts';
import * as schema from './schema.ts';

export function database(env: RuntimeEnv) {
  return drizzle(env.DB, { schema });
}
