# ADR 0001: npm workspace monorepo

Status: Accepted for V1 at M0 (2026-09-28); implementation starts only in authorized M1.

## Context

Master-plan §3.1 calls for one Next.js/NestJS repository with shared contracts/config. Baseline has no manifest, lockfile or competing package manager to preserve. Windows local reproducibility and short competition schedule favor a small build surface.

## Decision

Use npm workspaces with apps/web, apps/api and packages/contracts/config/eslint-config/tsconfig. Keep domain behavior in API and shared schemas/enums in contracts. UI never imports Prisma, auth secrets or server adapters. One root lockfile pins verified versions in M1. No additional monorepo orchestrator is required initially.

## Alternatives and consequences

Separate repositories duplicate contracts/version coordination; a new package manager provides no existing compatibility benefit here. Shared workspace increases need to enforce server/client import boundaries. Root scripts must run real owning checks; unavailable later milestone commands must not report success.

## Verification and scope

M1 installs and builds both apps, checks strict TS/lint and correct workspace dependencies; M2 validates shared OpenAPI/DTO alignment. M0 adds documents only. See [ARCHITECTURE](../ARCHITECTURE.md) and [IMPLEMENTATION_PLAN](../../IMPLEMENTATION_PLAN.md).
