import { describe, expect, it } from "vitest";

import { createDefaultSwarmDraft } from "./defaults";
import { createMockWorkspaceSession, getWorkspaceAgentSession, getWorkspaceTouchedFiles } from "./workspace";

describe("workspace session helpers", () => {
  const repository = {
    path: "C:/dev/forgeswarm",
    name: "forgeswarm",
    branch: "main",
    validationState: "valid" as const,
    stackBadges: [{ label: "React", confidence: "detected" as const }],
    detectedFiles: ["package.json"],
    issues: []
  };

  it("creates a seeded workspace session from repo and swarm draft", () => {
    const session = createMockWorkspaceSession(repository, createDefaultSwarmDraft(4));

    expect(session.status).toBe("running");
    expect(session.agents).toHaveLength(4);
    expect(session.coordinatorPlan).toHaveLength(3);
    expect(session.gitIsolation).toBeNull();
    expect(session.agents[0]?.git.status).toBe("planning");
  });

  it("selects the active agent session by id", () => {
    const session = createMockWorkspaceSession(repository, createDefaultSwarmDraft(4));
    const target = session.agents[1]!;

    expect(getWorkspaceAgentSession(session, target.agent.id).agent.id).toBe(target.agent.id);
  });

  it("returns scoped touched files for the requested agent", () => {
    const session = createMockWorkspaceSession(repository, createDefaultSwarmDraft(4));
    const target = session.agents[0]!;

    expect(getWorkspaceTouchedFiles(session, target.agent.id).every((file) => file.agentId === target.agent.id)).toBe(
      true
    );
    expect(getWorkspaceTouchedFiles(session).length).toBeGreaterThan(target.touchedFiles.length);
  });
});
