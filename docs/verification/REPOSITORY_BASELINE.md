# Repository Baseline

Inspected: 2026-09-28, before any M0 edits. Scope: the entire working tree, tracked and untracked files, including hidden files; Git internals were inspected through Git commands rather than treated as application source.

## Identity and Git state

- Workspace: `C:\Code\MobiFlow AI`.
- Branch: `main`.
- HEAD: `d853173d9291490501341b48d0b3d9d9d6e1905b` (`Initial commit`, 2026-09-28T14:02:14+07:00).
- Working tree: clean; no staged, unstaged, untracked, or ignored working files.
- No applicable pre-existing `AGENTS.md` at the repository root, `C:\Code`, or `C:\`.
- Execution host reported Windows NT 10.0.26200.0 and PowerShell 7.6.5. Docker, Node, npm, PostgreSQL, and Ollama availability were not tested; M0 does not require starting them.

## Complete initial file inventory

| File | Bytes | Observed content / reuse |
|---|---:|---|
| `.gitattributes` | 66 | Automatic text/LF normalization; preserve. |
| `.gitignore` | 2277 | General Node ecosystem exclusions, build/cache/log files and common local dotenv files; preserve. M1 must review local storage/model exclusions before creating those artifacts. |
| `README.md` | 78 | Product name and one-line local-AI description; retain identity and expand with documentation navigation. |

There are no package manifests or lockfiles, TypeScript or framework configs, Docker/Compose files, application source, database schemas or migrations, tests, scripts, dependency directories, existing specifications, or reusable application code. The only initial directory is `.git`.

## Supplied execution inputs

The full master plan (3,975 lines) and the user's pasted M0 execution prompt were read before edits. The prompt authorizes M0 only and explicitly overrides the master plan's generic permission to continue sequentially after a passing gate.

| Input | Original location | SHA-256 |
|---|---|---|
| Master plan | `C:\Users\AnhPhamPC\Downloads\MOBIFLOW_AI_ASTRA6_M0_M10_MASTER_PLAN.md` | `3B1711E3A42E8FA966A73080FCEAA41F3A23CF0E9C3719E9C6ABF3D1488ACE2A` |
| M0 execution prompt | `C:\Users\AnhPhamPC\.codex\attachments\4321515a-9792-4b31-b582-bd6515dbb2b0\Pasted text.txt` | `FA3E84CCC779542BD9E64A485A62DC2544FEF3EC8FBFC553FB2A10FB5102B392` |

Byte-identical archival copies will be kept under `docs/reference/`. They are provenance; the current user instruction determines authorized milestone scope.

Initial SHA-256 values: README `5CC28B0BC41A97E0FCC4AC3B302F226837C4CBBED5D756391E0E2B2B8F1B42CE`; .gitignore `03C2558AD26617D26D2BEE76ED12AA4948BC39A5A17F78EB250E9F7EA2938059`; .gitattributes `1A1DBE176BC233B499D35A57DB7513F2941C99AB9759F177830C9149BE99005B`.

## Inspection evidence

Executed from the workspace:

```powershell
git ls-files
git ls-tree -r --name-only HEAD
git status --porcelain=v1 --untracked-files=all
git ls-files --others --ignored --exclude-standard
git branch --show-current
git log -1 --format='%H%n%s%n%aI'
git diff --check
rg --files --hidden -g '!.git'
Get-Content -LiteralPath README.md,.gitignore,.gitattributes
Get-ChildItem -Force -Recurse -File | Where-Object { $_.FullName -notlike '*\.git\*' }
```

Tracked and complete working-file inventories agree. `git diff --check` returned success. A parent-file probe returned exit 1 because optional `AGENTS.md` files do not exist; explicit `Test-Path` probes confirmed absence. Two later shell sessions emitted profile `Import-Clixml` errors while still returning their results; clean no-profile Git checks were rerun successfully. These were host-profile issues, not repository test failures.

## M0 work boundary

Create the 25 required M0 documents, five ADRs included in that count; preserve both supplied inputs; add a dependency-free documentation checker and a contradiction-review record. Update only README among existing files. No dependencies, framework initialization, database migration, application feature, model installation, or service startup is needed.

Verification covers document completeness, local links, declared state/role/tool vocabulary, scope boundaries, traceability, and a manual cross-document review. Runtime lint, typecheck, application tests, build, Docker, live AI and RAG evaluation are not executable in this baseline and must be reported as not run, never PASS.

## Risks and blockers at discovery

No M0 repository blocker. The plan leaves cancellation actors, manual triage, SLA clock edges, exact taxonomy, and operational bounds to specification; M0 must resolve these explicitly. Library versions, installed model tags/dimensions, hardware capacity and runtime behavior require evidence in later milestones. The absence of an application is expected at M0 and is not evidence of V1 readiness.
