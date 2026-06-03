import type {
  AgentGitSessionRecord,
  AgentRecord,
  GitConflictState,
  GitIsolationPlanRecord,
  GitIsolationStatus,
  GitIsolationStrategy,
  GitRepositoryStatusRecord,
  ProtectedBranchRecord,
  RepositoryInspection,
  RepositoryRecord,
  WorkspaceSession
} from "@forgeswarm/shared";

export type { GitConflictState, GitIsolationPlanRecord, GitIsolationStatus, GitIsolationStrategy, GitRepositoryStatusRecord };

function now(): string {
  return new Date().toISOString();
}

function deriveConflictState(repositoryStatus: GitRepositoryStatusRecord): GitConflictState {
  if (repositoryStatus.hasConflicts) {
    return "conflicted";
  }

  if (repositoryStatus.isDirty) {
    return "dirty";
  }

  return "clean";
}

function derivePlanStatus(repositoryStatus: GitRepositoryStatusRecord): GitIsolationStatus {
  if (!repositoryStatus.gitAvailable || repositoryStatus.errors.length > 0 || repositoryStatus.hasConflicts) {
    return "error";
  }

  if (repositoryStatus.isDirty || repositoryStatus.warnings.length > 0) {
    return "warning";
  }

  return "ready";
}

function deriveProtectedBranch(repositoryStatus: GitRepositoryStatusRecord): ProtectedBranchRecord {
  return {
    name: repositoryStatus.protectedBranch,
    isProtected: true,
    currentBranch: repositoryStatus.currentBranch,
    detachedHead: repositoryStatus.detachedHead
  };
}

function deriveStrategy(
  preferredStrategy: GitIsolationStrategy,
  repositoryStatus: GitRepositoryStatusRecord
): GitIsolationStrategy {
  if (preferredStrategy === "worktree" && repositoryStatus.supportsWorktrees && !repositoryStatus.detachedHead) {
    return "worktree";
  }

  return "branch";
}

function createWorkspaceRecord(
  agent: AgentRecord,
  strategy: GitIsolationStrategy,
  repositoryStatus: GitRepositoryStatusRecord
): AgentGitSessionRecord {
  const conflictState = deriveConflictState(repositoryStatus);
  const status = derivePlanStatus(repositoryStatus);
  const baseBranch = repositoryStatus.protectedBranch;

  return {
    agentId: agent.id,
    strategy,
    branchName: agent.branchName,
    worktreePath: strategy === "worktree" ? agent.worktreePath : agent.worktreePath,
    baseBranch,
    status,
    conflictState,
    exists: status === "ready",
    note:
      status === "error"
        ? repositoryStatus.errors[0] ?? "Git isolation requires intervention before setup can continue."
        : status === "warning"
          ? repositoryStatus.warnings[0] ?? "Git isolation is available with repository warnings."
          : strategy === "worktree"
            ? "Isolated worktree is ready for this lane."
            : "Isolated branch is ready for this lane.",
    lastSyncedAt: now(),
    resetAvailable: status !== "error",
    rollbackAvailable: status !== "error"
  };
}

function createWarnings(repositoryStatus: GitRepositoryStatusRecord, strategy: GitIsolationStrategy): string[] {
  const warnings = [...repositoryStatus.warnings];

  if (strategy === "branch" && repositoryStatus.supportsWorktrees) {
    warnings.push("Branch isolation is active even though worktrees are supported.");
  }

  if (repositoryStatus.detachedHead) {
    warnings.push("Repository HEAD is detached. Falling back to branch-safe isolation metadata.");
  }

  return Array.from(new Set(warnings));
}

function createErrors(repositoryStatus: GitRepositoryStatusRecord): string[] {
  return Array.from(new Set(repositoryStatus.errors));
}

export function createMockGitRepositoryStatus(
  repository: Pick<RepositoryInspection | RepositoryRecord, "path" | "branch" | "validationState">
): GitRepositoryStatusRecord {
  const protectedBranch = repository.branch && repository.branch !== "detached" ? repository.branch : "main";
  const detachedHead = repository.branch === "detached";
  const gitAvailable = repository.validationState === "valid";
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!gitAvailable) {
    errors.push("Git metadata is unavailable for this repository.");
  }

  if (detachedHead) {
    warnings.push("Repository appears to be on a detached HEAD.");
  }

  return {
    repositoryPath: repository.path,
    currentBranch: repository.branch,
    protectedBranch,
    supportsWorktrees: gitAvailable,
    isDirty: false,
    hasConflicts: false,
    detachedHead,
    gitAvailable,
    warnings,
    errors
  };
}

export function createIsolationPlan(
  repository: Pick<RepositoryInspection | RepositoryRecord, "path" | "branch" | "validationState" | "name">,
  agents: AgentRecord[],
  preferredStrategy: GitIsolationStrategy = "worktree",
  repositoryStatus: GitRepositoryStatusRecord = createMockGitRepositoryStatus(repository)
): GitIsolationPlanRecord {
  const strategy = deriveStrategy(preferredStrategy, repositoryStatus);
  const workspaces = agents.map((agent) => createWorkspaceRecord(agent, strategy, repositoryStatus));

  return {
    repositoryPath: repository.path,
    strategy,
    status: derivePlanStatus(repositoryStatus),
    protectedBranch: deriveProtectedBranch(repositoryStatus),
    repositoryStatus,
    warnings: createWarnings(repositoryStatus, strategy),
    errors: createErrors(repositoryStatus),
    workspaces
  };
}

export function applyRepositoryStatusToPlan(
  plan: GitIsolationPlanRecord,
  repositoryStatus: GitRepositoryStatusRecord,
  preferredStrategy: GitIsolationStrategy = plan.strategy
): GitIsolationPlanRecord {
  const strategy = deriveStrategy(preferredStrategy, repositoryStatus);

  return {
    ...plan,
    strategy,
    status: derivePlanStatus(repositoryStatus),
    protectedBranch: deriveProtectedBranch(repositoryStatus),
    repositoryStatus,
    warnings: createWarnings(repositoryStatus, strategy),
    errors: createErrors(repositoryStatus),
    workspaces: plan.workspaces.map((workspace) => ({
      ...workspace,
      strategy,
      baseBranch: repositoryStatus.protectedBranch,
      status: derivePlanStatus(repositoryStatus),
      conflictState: deriveConflictState(repositoryStatus),
      exists: derivePlanStatus(repositoryStatus) === "ready",
      note:
        derivePlanStatus(repositoryStatus) === "error"
          ? repositoryStatus.errors[0] ?? "Git isolation requires intervention before setup can continue."
          : derivePlanStatus(repositoryStatus) === "warning"
            ? repositoryStatus.warnings[0] ?? "Git isolation is available with repository warnings."
            : strategy === "worktree"
              ? "Isolated worktree is ready for this lane."
              : "Isolated branch is ready for this lane.",
      lastSyncedAt: now(),
      resetAvailable: derivePlanStatus(repositoryStatus) !== "error",
      rollbackAvailable: derivePlanStatus(repositoryStatus) !== "error"
    }))
  };
}

export function applyIsolationPlanToWorkspace(
  workspace: WorkspaceSession,
  plan: GitIsolationPlanRecord
): WorkspaceSession {
  return {
    ...workspace,
    gitIsolation: plan,
    agents: workspace.agents.map((entry) => ({
      ...entry,
      git: plan.workspaces.find((item) => item.agentId === entry.agent.id) ?? entry.git
    }))
  };
}
