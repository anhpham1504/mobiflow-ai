# ADR 0003: Local Ollama on the Windows host

Status: Accepted for V1 at M0 (2026-09-28).

## Context

Primary demo target is Windows 11 + Docker Desktop, offline-capable after preparation. Host GPU/Docker behavior varies. Master-plan §§3.5–3.6 and 4.1 require local-first Ollama with provider abstraction and configurable models.

## Decision

Run Ollama on host Windows. Container API uses host.docker.internal:11434; native API uses localhost:11434. Provide OllamaLlmProvider and OllamaEmbeddingProvider behind independent ports. Select actual model tags/digests after local verification; Qwen-class and multilingual/bge-m3 examples are candidates, not installed-model claims. No automatic cloud fallback.

## Alternatives and consequences

Cloud-only runtime would violate the offline target. Dockerized Ollama may be an optional profile later but cannot be the sole supported path. Local inference requires measured hardware budgets/warmup and explicit availability/error UI; quality/latency cannot be promised from model names. Restrict host exposure while retaining Docker connectivity.

## Verification and scope

M1 verifies server/model health distinctions and offline nonfatal behavior; M4 actual generation; M5 dimension/retrieval; M9 measured latency/quality; M10 warmup/offline demo. Model downloads, tags and benchmarks are not part of M0. See [AI_ARCHITECTURE](../AI_ARCHITECTURE.md).
