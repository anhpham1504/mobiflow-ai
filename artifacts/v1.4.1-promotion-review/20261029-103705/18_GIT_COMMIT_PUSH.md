# Commit and push gate

Authorized target branch: `feat/v1.4.1-hybrid-auto-routing` only.

All live, regression, UI, security, fallback and deck gates passed before staging. The intended operation is one focused commit with message `feat: add deterministic hybrid auto-routing`, followed by an ordinary non-force push and equality check between local and `origin/feat/v1.4.1-hybrid-auto-routing`.

The final commit SHA cannot be embedded inside the same commit without self-reference. The exact commit SHA, tree SHA, file/change counts and local/remote equality are therefore recorded in the signed execution handoff/final response after the commit object and remote ref exist. No second evidence-only commit is permitted.

Forbidden operations remain unperformed: merge `main`, tag `v1.4.1`, publish release, modify official demo or replace frozen deck.
