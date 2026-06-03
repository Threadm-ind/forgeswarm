import { describe, expect, it } from "vitest";

import { createDefaultSwarmDraft, createMockWorkspaceSession } from "@forgeswarm/shared";

import { applyIsolationPlanToWorkspace, applyRepositoryStatusToPlan, createIsolationPlan, createMockGitRepositoryStatus } from "./index";

const repository = {
  path: "C:/dev/forgeswarm",
  name: "forgeswarm",
  branch: "main",
  validationState: "valid" as const
};

describe("git orchestrator", () => {
  it("creates a worktree-first isolation plan for a clean repository", () => {
    const workspace = createMockWorkspaceSession(
      {
        ...repository,
        stackBadges: [],
        detectedFiles: [],
        issues: []
      },
      createDefaultSwarmDraft(4)
    );
    const plan = createIsolationPlan(repository, workspace.agents.map((entry) => entry.agent));

    expect(plan.strategy).toBe("worktree");
    expect(plan.status).toBe("ready");
    expect(plan.protectedBranch.name).toBe("main");
    expect(plan.workspaces).toHaveLength(4);
  });

  it("falls back to branch isolation when worktrees are unavailable", () => {
    const workspace = createMockWorkspaceSession(
      {
        ...repository,
        stackBadges: [],
        detectedFiles: [],
        issues: []
      },
      createDefaultSwarmDraft(2)
    );
    const repositoryStatus = {
      ...createMockGitRepositoryStatus(repository),
      supportsWorktrees: false,
      warnings: ["Worktree support is unavailable in the current environment."]
    };

    const plan = createIsolationPlan(repository, workspace.agents.map((entry) => entry.agent), "worktree", repositoryStatus);

    expect(plan.strategy).toBe("branch");
    expect(plan.status).toBe("warning");
    expect(plan.warnings[0]).toContain("Worktree support");
  });

  it("applies isolation metadata back onto the workspace session", () => {
    const workspace = createMockWorkspaceSession(
      {
        ...repository,
        stackBadges: [],
        detectedFiles: [],
        issues: []
      },
      createDefaultSwarmDraft(4)
    );
    const basePlan = createIsolationPlan(repository, workspace.agents.map((entry) => entry.agent));
    const nextPlan = applyRepositoryStatusToPlan(basePlan, {
      ...basePlan.repositoryStatus,
      isDirty: true,
      warnings: ["Repository has uncommitted changes."]
    });
    const nextWorkspace = applyIsolationPlanToWorkspace(workspace, nextPlan);

    expect(nextWorkspace.gitIsolation?.status).toBe("warning");
    expect(nextWorkspace.agents.every((entry) => entry.git.baseBranch === "main")).toBe(true);
    expect(nextWorkspace.agents.some((entry) => entry.git.note.includes("uncommitted changes"))).toBe(true);
  });
});
