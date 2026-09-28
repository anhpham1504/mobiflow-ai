import { z } from 'zod';
import type { ApiEnvironment } from '@mobiflow/config';
import type { ComponentHealth } from '@mobiflow/contracts';

const tagsSchema = z.object({ models: z.array(z.object({ name: z.string(), digest: z.string().optional() })).max(1000) });
const showSchema = z.object({ capabilities: z.array(z.string()) });
const up: ComponentHealth = { status: 'UP', code: 'OK' };
const down: ComponentHealth = { status: 'DOWN', code: 'UNAVAILABLE' };

/** Health-only provider boundary. No inference, embedding or business tools in M1. */
export interface OllamaHealthProvider { healthCheck(): Promise<{ server: ComponentHealth; llm: ComponentHealth; embedding: ComponentHealth }> }
export class OllamaHealthClient implements OllamaHealthProvider {
  constructor(private readonly env: ApiEnvironment) {}
  private async json(path: string, signal: AbortSignal, body?: object): Promise<unknown> {
    const response = await fetch(new URL(path, this.env.OLLAMA_BASE_URL), {
      signal, redirect: 'error', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error('Dependency unavailable');
    return response.json();
  }
  async healthCheck() {
    const signal = AbortSignal.timeout(this.env.HEALTH_TIMEOUT_MS);
    let names: Set<string>;
    try { names = new Set(tagsSchema.parse(await this.json('/api/tags', signal)).models.map((model) => model.name)); }
    catch { return { server: down, llm: this.env.OLLAMA_MODEL==='unconfigured'?{status:'NOT_CONFIGURED' as const,code:'NOT_CONFIGURED' as const}:down, embedding: this.env.OLLAMA_EMBEDDING_MODEL==='unconfigured'?{status:'NOT_CONFIGURED' as const,code:'NOT_CONFIGURED' as const}:down }; }
    const checkModel = async (name: string, capability: string): Promise<ComponentHealth> => {
      if (name === 'unconfigured') return { status: 'NOT_CONFIGURED', code: 'NOT_CONFIGURED' };
      // Exact installed tag matching. Never infer availability from a default name.
      if (!names.has(name)) return { status: 'DOWN', code: 'MODEL_NOT_INSTALLED' };
      try {
        const details = showSchema.parse(await this.json('/api/show', signal, { model: name }));
        return details.capabilities.includes(capability) ? up : { status: 'DOWN', code: 'CAPABILITY_MISMATCH' };
      } catch { return { status: 'DOWN', code: 'INVALID_RESPONSE' }; }
    };
    const [llm, embedding] = await Promise.all([checkModel(this.env.OLLAMA_MODEL, 'completion'), checkModel(this.env.OLLAMA_EMBEDDING_MODEL, 'embedding')]);
    return { server: up, llm, embedding };
  }
}
