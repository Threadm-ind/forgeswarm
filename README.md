# ForgeSwarm

A local-first desktop workspace for supervised parallel coding. Designed as an operator console: select a repository, launch a swarm of specialised agents, watch them progress in parallel across isolated lanes, review diffs, and explicitly approve or reject before anything touches your main branch.

---

## What It Does

ForgeSwarm gives you a structured review process for multi-agent coding. Instead of one big agent session with unclear state, you get discrete lanes with visible progress, git isolation planning, a diff review interface, and an explicit merge queue. Nothing merges without your approval.

**Core flow:**

1. Select or validate a local Git repository
2. Configure a swarm: prompt, agent count, roles (scout, builder, reviewer, tester)
3. Start the workspace — the coordinator decomposes the task
4. Watch agent lanes progress through structured events
5. Inspect touched files, diff summaries, checks, and side-channel coordination
6. Review the Merge Queue — approve, reject, or request changes per lane
7. Protected branch stays clean until you explicitly approve

---

## Features

- **Parallel agent lanes** — coordinator, scout, builder, reviewer, and tester run concurrently
- **Git isolation planning** — per-agent branch planning with protected-branch enforcement
- **Diff review** — inspect generated diffs with approve/reject/request-changes workflow
- **Merge queue** — explicit gated approval before any lane touches the main branch
- **Side-channel coordination** — agents communicate through the workspace without polluting the main thread
- **SQLite persistence** — workspace, repository, swarm, diff, approval, and settings state normalized in SQLite
- **Demo session** — seeded demo for walkthroughs, layout review, and approval flow demonstrations
- **Local-first** — no cloud, no accounts, no phoning home

---

## Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v2 |
| Frontend | React 19, TypeScript |
| Styling | Tailwind CSS |
| Shared domain | `packages/shared` — domain model, orchestration reducers, merge helpers |
| UI primitives | `packages/ui` — design tokens, shared components |
| Agent runner | `packages/agent-runner` — mock swarm runner, command handling |
| Git planning | `packages/git-orchestrator` — isolation planning, workspace mapping |
| Backend persistence | SQLite (Tauri commands) |

---

## Monorepo Layout

```
apps/
  desktop/          Tauri v2 desktop shell + React frontend
packages/
  ui/               Shared UI primitives and design tokens
  shared/           Domain model, seeded workspaces, orchestration reducers
  agent-runner/     Mock swarm runner and command handling
  git-orchestrator/ Git isolation planning and workspace mapping
.planning/          GSD project brief, roadmap, execution state
```

---

## Setup

### Prerequisites

- Node.js 18+
- [corepack](https://nodejs.org/api/corepack.html) enabled: `corepack enable`
- Rust + Cargo (for native Tauri builds)

### Install and run

```bash
corepack pnpm install

# Browser-mode frontend (no Rust required)
corepack pnpm --filter @forgeswarm/desktop dev

# Full native Tauri app
corepack pnpm --filter @forgeswarm/desktop dev:tauri
```

---

## Commands

```bash
corepack pnpm install       # Install all workspace deps
corepack pnpm test          # Run all tests
corepack pnpm lint          # Lint all packages
corepack pnpm typecheck     # TypeScript check
corepack pnpm build         # Build all packages
```

---

## Demo Mode

On the Home screen, click **Load Demo Session**. This opens a pre-seeded workspace with:

- A validated ForgeSwarm repository
- A six-agent swarm draft
- Git isolation metadata
- A mock workspace session ready to inspect
- Pending diffs and merge approvals to walk through

Useful for product demonstrations and reviewing the approval flow without running real agents.

---

## Current Status

Frontend is fully implemented and verified. The mock orchestration engine produces realistic lane progression, review gating, and coordinator behavior without live model dependencies.

Native Tauri builds require Rust/Cargo. The browser fallback path works without it — LocalStorage replaces SQLite persistence in that mode.
