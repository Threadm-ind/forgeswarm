# Phase 08 Verification Checklist

Use this checklist to manually accept the ForgeSwarm MVP.

## Automated Baseline

Already passed before manual verification:

- `corepack pnpm test`
- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm build`

Known environment limitation:

- `corepack pnpm --filter @forgeswarm/desktop exec tauri info` still reports missing `rustc`, `cargo`, and Visual Studio / MSVC Build Tools with Windows SDK components

## Manual Acceptance Checklist

### Startup And Demo

- [ ] Launch the app in browser or desktop dev mode.
- [ ] Confirm the Home screen loads with recent repositories and repo-picker actions.
- [ ] Click `Load Demo Session`.
- [ ] Confirm the app opens into a hydrated workspace instead of a blank shell.

### Repo Intake And Swarm Setup

- [ ] Return to `Home`.
- [ ] Validate a seeded recent repository or paste a local repo path.
- [ ] Confirm repository validation, detected stack badges, and issues render clearly.
- [ ] Continue into `Swarm Setup`.
- [ ] Change agent count and at least one role assignment.
- [ ] Toggle execution preferences and confirm the setup screen responds cleanly.

### Workspace Supervision

- [ ] Start a workspace from the setup screen.
- [ ] Switch between agents and confirm the terminal, touched files, and review context change with the active lane.
- [ ] Use `Pause`, `Resume`, and `Roll Call` and confirm status/timeline updates remain visible.
- [ ] Send a direct message to an agent and confirm the coordination feed reflects it.

### Merge Queue And Review

- [ ] Open `Merge Queue`.
- [ ] Confirm queue entries are derived from active isolated lanes rather than placeholder rows.
- [ ] Select at least one lane and inspect diff sections, touched files, checks, and approval history.
- [ ] Use `Approve` on one lane and confirm the approval state updates in both Merge Queue and Workspace.
- [ ] Use `Request Changes` or `Reject` on another lane and confirm blocked readiness messaging appears.
- [ ] Use `Open Workspace` from the queue and confirm focus returns to the correct lane.

### Settings And Persistence

- [ ] Open `Settings`.
- [ ] Change appearance, keyboard preset, repo permission posture, and provider placeholder.
- [ ] Confirm the Settings screen reflects the changes immediately.
- [ ] Reload the app.
- [ ] Confirm the updated settings persist across reload.

### Documentation And Delivery

- [ ] Read `README.md`.
- [ ] Confirm the documented feature set matches the implemented app behavior.
- [ ] Confirm README does not overclaim native verification or live provider integration.

## If Issues Are Found

Create a phase issues file and then run:

- `gsd:plan-fix`

Recommended issues file path if needed:

- `.planning/phases/08-settings-polish-and-delivery-assets/08-01-ISSUES.md`
