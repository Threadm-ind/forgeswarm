import { invoke } from "@tauri-apps/api/core";
import {
  applyIsolationPlanToWorkspace,
  applyRepositoryStatusToPlan,
  createIsolationPlan,
  createMockGitRepositoryStatus,
  type GitIsolationPlanRecord,
  type GitRepositoryStatusRecord
} from "@forgeswarm/git-orchestrator";
import type { WorkspaceSession } from "@forgeswarm/shared";

function planWorkspaceIsolation(workspace: WorkspaceSession, repositoryStatus?: GitRepositoryStatusRecord): GitIsolationPlanRecord {
  return createIsolationPlan(
    {
      path: workspace.repository.path,
      name: workspace.repository.name,
      branch: workspace.repository.branch,
      validationState: workspace.repository.validationState
    },
    workspace.agents.map((entry) => entry.agent),
    "worktree",
    repositoryStatus ?? createMockGitRepositoryStatus(workspace.repository)
  );
}

export async function synchronizeWorkspaceGitIsolation(workspace: WorkspaceSession): Promise<WorkspaceSession> {
  const fallbackStatus = createMockGitRepositoryStatus(workspace.repository);
  let plan = planWorkspaceIsolation(workspace, fallbackStatus);

  try {
    const repositoryStatus = await invoke<GitRepositoryStatusRecord>("inspect_git_repository", {
      path: workspace.repository.path
    });
    plan = applyRepositoryStatusToPlan(plan, repositoryStatus);
  } catch {
    plan = {
      ...plan,
      status: plan.status === "error" ? "error" : "warning",
      warnings: [...plan.warnings, "Native Git inspection unavailable. Showing planned isolation metadata only."]
    };

    return applyIsolationPlanToWorkspace(workspace, plan);
  }

  try {
    const synchronizedPlan = await invoke<GitIsolationPlanRecord>("setup_git_isolation", {
      path: workspace.repository.path,
      plan
    });

    return applyIsolationPlanToWorkspace(workspace, synchronizedPlan);
  } catch {
    plan = {
      ...plan,
      status: plan.status === "error" ? "error" : "warning",
      warnings: [...plan.warnings, "Native Git isolation setup unavailable. Planned isolation lanes remain visible."]
    };

    return applyIsolationPlanToWorkspace(workspace, plan);
  }
}

export function createDemoWorkspaceWithGit(workspace: WorkspaceSession): WorkspaceSession {
  return applyIsolationPlanToWorkspace(workspace, planWorkspaceIsolation(workspace));
}
