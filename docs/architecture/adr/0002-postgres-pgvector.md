# ADR 0002: PostgreSQL and pgvector in one database

Status: Accepted for V1 at M0 (2026-09-28).

## Context

Business transactions, ownership-filtered retrieval and source provenance must remain consistent on a local laptop. Master-plan §§3.4 and 5 fixes PostgreSQL + pgvector with Prisma; a separate vector database is a non-goal.

## Decision

Store business rows and vectors in the same PostgreSQL instance. Enable pgvector through migration/init in M1. Use Prisma for business entities and a dedicated parameterized SQL vector repository if needed. Do not guess model dimension: validate the selected embedding in M5, record identity/D, then migrate vector(D)/cosine indexes. Reindex on model change, even if dimensions match.

## Alternatives and consequences

SQLite lacks required PostgreSQL/vector/transaction equivalence for integration tests. A separate vector service adds authorization, consistency and operational complexity forbidden by scope. Raw vector SQL may be necessary but stays bound and isolated. Old generations remain immutable for audit while only current compatible READY generations participate in live retrieval.

## Verification and scope

M1 extension readiness; M2 empty-DB migrations/constraints; M5 real index/search/dimension tests; M6 scoped request similarity; M7 transactional review. Least-privilege runtime credentials and a private DB network are mandatory. See [DATABASE_SPEC](../../specs/DATABASE_SPEC.md) and [RAG_SPEC](../../specs/RAG_SPEC.md).
