/**
 * Minimal stand-in for expo-sqlite's synchronous API, backed by Node's built-in SQLite,
 * so the real schema and queries can run in Jest.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
// Loaded with require so the app does not need Node type definitions (tests run on Node 22.5+).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => any };

type Params = any[];

function normalize(params: Params): any[] {
  // expo-sqlite accepts (sql, a, b) or (sql, [a, b]) or (sql, { $a })
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  if (params.length === 1 && params[0] !== null && typeof params[0] === 'object') return [params[0]];
  return params;
}

const plain = (row: any) => (row ? { ...row } : row);

export function openTestDatabase() {
  const raw = new DatabaseSync(':memory:');
  return {
    execSync: (sql: string) => raw.exec(sql),
    runSync: (sql: string, ...params: Params) => {
      const r = raw.prepare(sql).run(...normalize(params));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    getFirstSync: (sql: string, ...params: Params) => plain(raw.prepare(sql).get(...normalize(params))) ?? null,
    getAllSync: (sql: string, ...params: Params) => raw.prepare(sql).all(...normalize(params)).map(plain),
    withTransactionSync: (fn: () => void) => {
      raw.exec('BEGIN');
      try {
        fn();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
    prepareSync: (sql: string) => {
      const stmt = raw.prepare(sql);
      return { executeSync: (p: any[]) => stmt.run(...p), finalizeSync: () => {} };
    },
  };
}
