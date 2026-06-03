# ForgeSwarm Roadmap

## Milestone

Believable MVP for an operator-first, supervised multi-agent desktop coding workspace.

## Phase 01: Foundation and Monorepo Scaffold

Status: In Progress, implementation complete with native Windows verification blocked by missing MSVC build tools

Goal:

Create the monorepo foundation, shared package boundaries, desktop app shell baseline, and the core technical scaffolding required for iterative MVP delivery.

Acceptance Conditions:

- Monorepo contains `apps/desktop`, `packages/ui`, `packages/shared`, `packages/agent-runner`, and `packages/git-orchestrator`
- Tauri v2 desktop shell runs locally
- React 19, TypeScript, and Tailwind CSS are wired into the desktop app
- Shared types and package boundaries are established
- Baseline build, lint, and test commands are defined

## Phase 02: Repo Intake and Swarm Setup

Status: In Progress, implementation complete with browser/frontend verification clean and native Windows verification still blocked by missing MSVC build tools

Goal:

Implement the repo picker and swarm setup flow so a user can select a local Git repository, validate it, inspect detected stack metadata, and configure a swarm task with roles and execution controls.

Acceptance Conditions:

- Home screen includes recent repos, open-folder CTA, validation state, and detected stack badges
- Repo validation handles non-repos and protected/error states clearly
- Swarm setup supports task input, agent count selection, role roster, and required toggles
- Setup state is strongly typed and ready to persist

## Phase 03: Workspace Shell and Supervision UX

Status: In Progress, implementation complete with browser/frontend verification clean and native Windows verification still blocked by missing MSVC build tools

Goal:

Build the three-column workspace with dense operational visibility for agents, task state, coordinator planning, terminal output, touched files, and review context.

Acceptance Conditions:

- Left column shows swarm navigation, agent list, task status, and touched files
- Center column shows active terminal pane, timeline, and coordinator plan
- Right column shows diff viewer shell, checks, approvals, and comments
- User can switch active agents and view per-agent activity without losing context

## Phase 04: Local Persistence and Demo Data

Status: In Progress, implementation complete with frontend/browser verification clean and native Windows verification still blocked by missing MSVC build tools

Goal:

Add SQLite-backed persistence for core entities and ship a seeded demo session so the app remains useful across restarts and can demonstrate the workflow without live orchestration.

Acceptance Conditions:

- Local persistence exists for repositories, swarms, agents, tasks, messages, terminal sessions, diffs, approvals, settings, and check runs
- Repository and swarm state survive app restarts
- A seed demo swarm can populate the app for showcase flows
- Persistence boundaries are clean enough to swap storage implementation details later if needed

## Phase 05: Mock Orchestration Engine

Status: In Progress, implementation complete with frontend verification clean and native Tauri verification blocked by missing Rust/MSVC toolchains

Goal:

Implement a believable role-based orchestration model using structured tasks and events rather than freeform chat, including coordinator decomposition, visible inter-agent coordination, status verification, and agent lifecycle controls.

Acceptance Conditions:

- Coordinator decomposes a top-level task into structured subtasks
- Scout inspects repository structure first in mock mode
- Builder, Reviewer, and Tester flows exist as distinct role behaviors
- Coordinator can initiate a swarm-wide roll call or status verification sequence
- Inter-agent coordination appears in an inspectable side-chat or event stream rather than hidden internal state
- Agents support pause, resume, stop, and direct user messaging
- Timeline, logs, and agent status update from structured event streams

## Phase 06: Git Isolation Layer

Status: In Progress, implementation complete with frontend verification clean and native Tauri verification blocked by missing Rust/MSVC toolchains

Goal:

Add isolated Git worktree or branch management per agent while protecting the main branch and surfacing errors or conflicts clearly.

Acceptance Conditions:

- Each agent receives isolated Git context via worktree or branch abstraction
- Main branch remains untouched until approval
- No force-push workflow exists in the MVP
- Rollback or reset actions are available behind confirmation
- Conflict states and Git failures are visible in the UI and audit trail

## Phase 07: Diff Review, Checks, and Merge Queue

Status: In Progress, implementation complete with frontend verification clean and native Tauri verification still blocked by missing Rust/MSVC toolchains

Goal:

Implement review workflows for diffs, checks, approvals, and explicit merge gating so supervised merges are the core operational loop of the app.

Acceptance Conditions:

- Merge Queue screen lists pending branches or worktrees with diff summaries
- Reviewer and Tester checks run before merge when configured
- User can approve, reject, or request changes
- Merge approval is explicit and audited
- Diff review is usable enough for believable MVP demonstrations

## Phase 08: Settings, Polish, and Delivery Assets

Status: In Progress, implementation complete with frontend verification clean and native Tauri verification still blocked by missing Rust/MSVC toolchains

Goal:

Finish local settings, provider placeholders, desktop polish, README guidance, and developer-facing demo assets for the MVP.

Acceptance Conditions:

- Settings screen covers local preferences, provider placeholders, repo permissions, keyboard shortcuts, and appearance
- Visual design is dark, dense, readable, and operationally clear
- README explains setup, architecture, mock mode, and demo flow
- MVP includes a demo seed path and practical local development instructions

## Dependencies and Order

- Phase 01 unlocks all implementation work
- Phase 02 depends on Phase 01
- Phase 03 depends on Phases 01 and 02
- Phase 04 can begin after basic app structure from Phases 01 and 02 exists
- Phase 05 depends on Phase 03 and should integrate with Phase 04 persistence while preserving the workspace-versus-swarm architecture split
- Phase 06 depends on the orchestration contract from Phase 05
- Phase 07 depends on Phases 05 and 06
- Phase 08 closes the MVP after core workflows are functioning

## Recommended Next Command

Run `gsd:verify-work`.
