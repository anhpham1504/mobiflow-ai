import { Inject, Injectable } from '@nestjs/common';
import type { Readiness } from '@mobiflow/contracts';
import type { DatabaseProbe } from './database.js';
import type { OllamaHealthProvider } from './ollama.js';
import {RagHealth} from '../knowledge/rag-health.js';

export const DATABASE_PROBE = Symbol('DATABASE_PROBE');
export const OLLAMA_HEALTH = Symbol('OLLAMA_HEALTH');
@Injectable()
export class HealthService {
  private pending?: Promise<Readiness>;
  constructor(@Inject(DATABASE_PROBE) private readonly database: DatabaseProbe, @Inject(OLLAMA_HEALTH) private readonly ollama: OllamaHealthProvider,private readonly rag:RagHealth) {}
  ready(): Promise<Readiness> {
    // Coalesce simultaneous polls, but never retain stale health after completion.
    return this.pending ??= this.probe().finally(() => { this.pending = undefined; });
  }
  private async probe(): Promise<Readiness> {
    const [db, ai] = await Promise.all([this.database.check(), this.ollama.healthCheck()]);
    const coreReady = db.database.status === 'UP' && db.vector.status === 'UP';
    const aiReady = ai.server.status === 'UP' && ai.llm.status === 'UP' && ai.embedding.status === 'UP';
    return { status: !coreReady ? 'NOT_READY' : aiReady ? 'READY' : 'DEGRADED', coreReady, aiReady, rag:this.rag.view(),checkedAt: new Date().toISOString(), components: {
      API: { status: 'UP', code: 'OK' }, DATABASE: db.database, VECTOR_EXTENSION: db.vector,
      OLLAMA_SERVER: ai.server, OLLAMA_LLM_MODEL: ai.llm, OLLAMA_EMBEDDING_MODEL: ai.embedding,
    } };
  }
}
