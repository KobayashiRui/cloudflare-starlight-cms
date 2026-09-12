/// <reference path="../sql.d.ts" />
import schema from '../../migrations/0001_schema.sql';
import delivery from '../../migrations/0002_publish_delivery.sql';

// Only these bounded, idempotent CREATE migrations run on requests. Future
// ALTER/backfill migrations need an explicit deployment migration plan.
const migrations = [
  ['0001_schema.sql', schema],
  ['0002_publish_delivery.sql', delivery],
] as const;
const ready = new WeakSet<D1Database>();

export async function ensureSchema(db: D1Database): Promise<void> {
  if (ready.has(db)) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS d1_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`).run();
  const applied = await db.prepare('SELECT name FROM d1_migrations').all<{ name: string }>();
  const names = new Set(applied.results.map((row) => row.name));
  for (const [name, sql] of migrations) {
    if (names.has(name)) continue;
    const statements = sql.split(';').map((part) => part.trim()).filter(Boolean);
    if (statements.some((statement) => !/^CREATE (?:TABLE|(?:UNIQUE )?INDEX) IF NOT EXISTS\s/i.test(statement))) {
      throw new Error('Runtime bootstrap only supports idempotent CREATE statements');
    }
    // D1 batch rolls back schema and history together on failure. Concurrent
    // bootstraps are safe because every statement is idempotent.
    await db.batch([
      ...statements.map((statement) => db.prepare(statement)),
      db.prepare('INSERT OR IGNORE INTO d1_migrations (name) VALUES (?)').bind(name),
    ]);
  }
  ready.add(db);
}
