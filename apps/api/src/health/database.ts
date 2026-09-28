import { Pool } from 'pg';
import type { ComponentHealth } from '@mobiflow/contracts';

export interface DatabaseProbe { check(): Promise<{ database: ComponentHealth; vector: ComponentHealth }>; close(): Promise<void> }
export class PostgresProbe implements DatabaseProbe {
  private readonly pool: Pool;
  constructor(connectionString: string, timeout: number) {
    this.pool = new Pool({ connectionString, max: 3, connectionTimeoutMillis: timeout, query_timeout: timeout, statement_timeout: timeout, idleTimeoutMillis: 10000 });
    // A severed idle connection must not terminate the API process.
    this.pool.on('error', () => {});
  }
  async check() {
    try {
      const result = await this.pool.query<{ extversion: string }>("SELECT extversion FROM pg_extension WHERE extname = $1", ['vector']);
      return { database: { status: 'UP', code: 'OK' } as ComponentHealth, vector: result.rowCount ? { status: 'UP', code: 'OK' } as ComponentHealth : { status: 'DOWN', code: 'EXTENSION_MISSING' } as ComponentHealth };
    } catch {
      return { database: { status: 'DOWN', code: 'UNAVAILABLE' } as ComponentHealth, vector: { status: 'DOWN', code: 'UNAVAILABLE' } as ComponentHealth };
    }
  }
  close() { return this.pool.end(); }
}
