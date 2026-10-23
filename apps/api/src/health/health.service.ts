import { Inject, Injectable } from '@nestjs/common';
import type { Readiness } from '@mobiflow/contracts';
import type { DatabaseProbe } from './database.js';
import type { OllamaHealthProvider } from './ollama.js';
import {RagHealth} from '../knowledge/rag-health.js';
import type {ApiEnvironment} from '@mobiflow/config';
import {API_ENV} from '../tokens.js';
import {AI_PROVIDER_TOKEN,type AiProvider,type HealthAwareAiProvider} from '../ai/provider.js';

export const DATABASE_PROBE = Symbol('DATABASE_PROBE');
export const OLLAMA_HEALTH = Symbol('OLLAMA_HEALTH');
@Injectable()
export class HealthService {
  private pending?: Promise<Readiness>;
  constructor(@Inject(DATABASE_PROBE) private readonly database: DatabaseProbe, @Inject(OLLAMA_HEALTH) private readonly ollama: OllamaHealthProvider,private readonly rag:RagHealth,@Inject(API_ENV)private readonly env:ApiEnvironment,@Inject(AI_PROVIDER_TOKEN)private readonly provider:AiProvider) {}
  ready(): Promise<Readiness> {
    // Coalesce simultaneous polls, but never retain stale health after completion.
    return this.pending ??= this.probe().finally(() => { this.pending = undefined; });
  }
  private async probe(): Promise<Readiness> {
    const db=await this.database.check(),disabled={status:'DISABLED' as const,code:'NOT_CONFIGURED' as const};
    const ai=this.env.AI_GENERATION_PROVIDER==='ollama'?await this.ollama.healthCheck():{server:disabled,llm:disabled,embedding:disabled};
    const generation=this.env.AI_GENERATION_PROVIDER==='deepseek'?('healthSnapshot' in this.provider?(this.provider as HealthAwareAiProvider).healthSnapshot():(this.env.AI_LIVE_CALLS_ENABLED?{status:'UP' as const,code:'OK' as const}:{status:'DISABLED' as const,code:'LIVE_CALLS_DISABLED' as const})):ai.llm;
    const rag=this.rag.view(),retrieval=rag.status==='READY'?{status:'UP' as const,code:'OK' as const}:rag.status==='DISABLED'?disabled:{status:'DOWN' as const,code:'UNAVAILABLE' as const};
    const coreReady = db.database.status === 'UP' && (this.env.RAG_RETRIEVAL_MODE==='lexical'||db.vector.status === 'UP');
    const aiReady = generation.status === 'UP' && (!this.env.AI_RAG_ENABLED||retrieval.status==='UP');
    return { status: !coreReady ? 'NOT_READY' : aiReady ? 'READY' : 'DEGRADED', coreReady, aiReady, rag,checkedAt: new Date().toISOString(), components: {
      API: { status: 'UP', code: 'OK' }, DATABASE: db.database, VECTOR_EXTENSION: db.vector,
      AI_GENERATION:generation,RAG_RETRIEVAL:retrieval,DEEPSEEK_API:this.env.AI_GENERATION_PROVIDER==='deepseek'?generation:disabled,
      OLLAMA_SERVER: ai.server, OLLAMA_LLM_MODEL: ai.llm, OLLAMA_EMBEDDING_MODEL: ai.embedding,
    } };
  }
}
