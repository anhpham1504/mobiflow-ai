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
  private async json(path: string, signal: AbortSignal, body?: object,origin=this.env.OLLAMA_BASE_URL): Promise<unknown> {
    const response = await fetch(new URL(path, origin), {
      signal, redirect: 'error', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error('Dependency unavailable');
    return response.json();
  }
  async healthCheck() {
    const signal = AbortSignal.timeout(this.env.HEALTH_TIMEOUT_MS);
    const inventory=async(origin:string)=>{try{return new Set(tagsSchema.parse(await this.json('/api/tags',signal,undefined,origin)).models.map(m=>m.name));}catch{return null;}};
    const origin=this.env.EMBEDDING_BASE_URL??this.env.OLLAMA_BASE_URL;
    const [names,embeddingNames]=await Promise.all([inventory(this.env.OLLAMA_BASE_URL),origin===this.env.OLLAMA_BASE_URL?Promise.resolve(undefined):inventory(origin)]);
    const checkModel = async (name: string, capability: string,names:Set<string>|null,origin:string): Promise<ComponentHealth> => {
      if (name === 'unconfigured') return { status: 'NOT_CONFIGURED', code: 'NOT_CONFIGURED' };
      if(!names)return down;
      // Exact installed tag matching. Never infer availability from a default name.
      if (!names.has(name)) return { status: 'DOWN', code: 'MODEL_NOT_INSTALLED' };
      try {
        const details = showSchema.parse(await this.json('/api/show', signal, { model: name },origin));
        return details.capabilities.includes(capability) ? up : { status: 'DOWN', code: 'CAPABILITY_MISMATCH' };
      } catch { return { status: 'DOWN', code: 'INVALID_RESPONSE' }; }
    };
    const [llm, embedding] = await Promise.all([checkModel(this.env.OLLAMA_MODEL, 'completion',names,this.env.OLLAMA_BASE_URL), checkModel(this.env.OLLAMA_EMBEDDING_MODEL, 'embedding',embeddingNames===undefined?names:embeddingNames,origin)]);
    return { server:names?up:down, llm, embedding };
  }
}
