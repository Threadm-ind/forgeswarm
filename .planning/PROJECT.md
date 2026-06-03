# ForgeSwarm Project Brief

## Summary

ForgeSwarm is a local-first desktop application for supervised parallel coding. It lets a developer select a local Git repository, create a swarm for a concrete task, assign specialized agent roles, watch execution in parallel terminal panes, review diffs, and explicitly approve merges before any changes land on the protected main branch.

This is a developer tool, not a chatbot product. The MVP should feel like an operator console for agentic engineering: clear supervision controls, visible agent state, isolated Git workspaces, and a mock orchestration mode that proves the product shape without overbuilding live model integration.

ForgeSwarm should embody two complementary layers:

- Workspace layer: the local execution surface where the operator inspects repositories, terminals, files, diffs, checks, and approvals
- Swarm layer: the coordination surface where specialized agents receive structured tasks, communicate through explicit events, and report status back to the operator

The operator remains the human single source of truth. Agents can coordinate autonomously inside the swarm, but ForgeSwarm must always preserve inspectability, merge gating, and explicit human approval over protected branch changes.

## Primary User

- Individual software developers working locally on an existing Git repository
- Small teams evaluating supervised multi-agent coding workflows on a single machine

## Primary Use Cases

- Open a local repository and validate it as a usable workspace
- Create a swarm from a task prompt
- Choose a practical agent count and role roster
- Run multiple specialized agents in isolated Git worktrees or branches
- Observe logs, terminal output, touched files, diffs, and task progress in one workspace
- Review checks and explicitly approve or reject merges
- Persist local state and reopen prior work
- Demonstrate the full workflow with a mock orchestration engine and seeded demo session

## Goals

- Deliver a believable MVP desktop app for supervised parallel coding
- Prove the end-to-end flow from repo selection to merge approval
- Keep main branch untouched until explicit user approval
- Make orchestration role-based and event-driven rather than uncontrolled freeform chat
- Reduce orchestration cognitive load by separating local execution surfaces from swarm coordination behavior
- Make agent-to-agent coordination inspectable enough that the user can supervise without micromanaging
- Keep the codebase modular enough to replace mocks with real model backends later

## Must Be Excellent

- Operational clarity of the supervised workflow

The app must make it obvious what each agent is doing, what files changed, what checks ran, and when the human must intervene to approve or reject merge actions.

## MVP Scope

- Tauri v2 desktop shell with React 19, TypeScript, Tailwind CSS, Rust backend commands, SQLite persistence, and xterm.js terminal panes
- Monorepo structure:
  - `apps/desktop`
  - `packages/ui`
  - `packages/shared`
  - `packages/agent-runner`
  - `packages/git-orchestrator`
- Screens:
  - Home / Repo Picker
  - Swarm Setup
  - Workspace
  - Merge Queue
  - Settings
- Persisted entities:
  - repositories
  - swarms
  - agents
  - tasks
  - messages
  - terminal sessions
  - diffs
  - approvals
  - settings
  - check runs
- Mock orchestration engine with role-based task/event model
- Explicit coordinator plan, inter-agent event log, and visible side-channel agent messaging in mock mode
- Status verification workflow where the coordinator can perform a swarm-wide roll call and report synchronized state
- Git isolation per agent via worktree or branch abstraction
- Diff review and explicit merge approval flow
- Demo seed data for one believable swarm session

## Non-Goals

- Full autonomous coding without supervision
- Production-grade live model/provider integration in the MVP
- Remote orchestration services or unnecessary backend services
- Unprotected writes directly onto the main branch
- A chatbot-style conversational product experience
- Simulating large-scale hosted swarm infrastructure or enterprise-scale agent counts in the MVP

## Constraints

- Local-first architecture
- Desktop app built with Tauri v2
- Strong typing and production-quality TypeScript
- Reusable UI components and clear module boundaries
- SQLite used for local persistence
- xterm.js used for terminal panes
- Rust used for Tauri backend commands
- Prefer mocks and stubs over speculative infrastructure
- Keep design dark, dense, readable, and operationally focused
- Destructive commands and repo deletes require confirmation
- Merge actions require explicit approval
- Maintain an audit trail for agent actions

## Key Product Decisions

- Main branch is protected in the MVP
- Agent work is isolated with one worktree or branch per agent
- Reviewer and Tester roles are first-class checks before merge
- Orchestration is structured around tasks, roles, and events
- ForgeSwarm is designed as an operator-first ADE, with a strict separation between workspace execution surfaces and swarm coordination logic
- Coordinator role owns decomposition, roll call, and swarm-level synchronization
- Scout inspects repository structure before execution begins
- Builder roles focus on subtask implementation work rather than freeform exploration
- Reviewer roles audit diffs and regressions before approval
- Agent communication is visible through structured events and side-chat style message surfaces, not hidden autonomous state
- Mock orchestration mode is a required product path, not a temporary afterthought
- Local persistence is part of the MVP, not deferred polish

## Build Order

1. Monorepo scaffold
2. Desktop shell
3. Repo picker
4. Swarm setup
5. Workspace layout
6. Persistence layer
7. Mock orchestration engine
8. Git isolation layer
9. Diff viewer and merge approvals
10. Settings and polish
11. README and demo seed

## Success Criteria

- A developer can launch the desktop app and select a local Git repository
- The app validates the repo and surfaces basic detected stack metadata when possible
- A developer can create a swarm with a task prompt and choose 2, 4, 6, or 8 agents
- Default and editable role assignments are available for Coordinator, Builder, Scout, Reviewer, and Tester
- Each agent session is represented with isolated Git context and visible terminal/log output
- The workspace shows touched files, diffs, checks, coordinator plan, and agent status in a usable three-column layout
- The operator can inspect structured agent communication and trigger or observe a coordinator-led status verification flow
- Reviewer and Tester checks run in the mock workflow before merge approval
- Merge actions are explicitly approved or rejected by the user
- Local state survives app restarts
- A demo seed session can be loaded to show the product without requiring real agent backends

## Assumptions

- The repository is currently greenfield, so no `map-codebase` step is needed before roadmap creation
- PTY handling should stay inside the desktop app unless a small Node helper becomes materially simpler
- The first implementation should optimize for a convincing local demo rather than full execution fidelity
- Provider specialization should be modeled as role semantics and placeholders first, without hard-coding the product around any one external vendor

## Risks To Watch

- PTY integration complexity across platforms
- Git worktree management edge cases on Windows
- Keeping the mock orchestration believable without overbuilding runtime complexity
- Avoiding a UI that looks like generic chat instead of an operator console
- Letting role specialization drift into hidden magic instead of explicit, inspectable supervision primitives

## Immediate Next Step

Run `gsd:create-roadmap` to turn this brief into phased execution artifacts under `.planning/`.
