import { describe, expect, it } from "vitest";

import { createDefaultSwarmDraft } from "./defaults";
import { applyApprovalDecision, deriveMergeQueueEntries, findMergeQueueEntry, getMergeReadiness } from "./review";
import { createMockWorkspaceSession } from "./workspace";

const repository = {
  path: "C:/dev/forgeswarm",
  name: "forgeswarm",
  branch: "main" as const,
  validationState: "valid" as const,
  stackBadges: [{ label: "React", confidence: "detected" as const }],
  detectedFiles: ["package.json"],
  issues: []
};

function createReadyForDecisionWorkspace() {
  const workspace = createMockWorkspaceSession(repository, createDefaultSwarmDraft(6));

  return {
    ...workspace,
    orchestrationStage: "awaiting-approval" as const,
    status: "review" as const,
    agents: workspace.agents.map((entry) => ({
      ...entry,
      agent: {
        ...entry.agent,
        status:
          entry.agent.role === "Reviewer" || entry.agent.role === "Tester"
            ? "completed"
            : entry.agent.status
      },
      checks:
        entry.agent.role === "Tester"
          ? entry.checks.map((check) => ({
              ...check,
              status: "passed" as const,
              summary: `${check.name} passed in mock mode.`
            }))
          : entry.checks
    }))
  };
}

describe("merge review helpers", () => {
  it("derives merge queue entries from workspace and git isolation state", () => {
    const workspace = createReadyForDecisionWorkspace();
    const entries = deriveMergeQueueEntries(workspace);

    expect(entries).toHaveLength(workspace.agents.length);
    expect(entries[0]?.checks.every((check) => check.status === "passed")).toBe(true);
    expect(entries.some((entry) => entry.mergeReadiness === "awaiting-decision")).toBe(true);
  });

  it("promotes approved lanes to ready status", () => {
    const workspace = createReadyForDecisionWorkspace();
    const agentId = workspace.agents[0]!.agent.id;
    const approved = applyApprovalDecision(workspace, {
      actor: "Operator",
      agentId,
      createdAt: "2026-03-10T10:00:00.000Z",
      status: "approved"
    });

    const entry = findMergeQueueEntry(approved, agentId);

    expect(entry?.approval.status).toBe("approved");
    expect(entry?.mergeReadiness).toBe("ready");
    expect(entry?.approval.auditTrail.at(-1)?.action).toBe("approved");
  });

  it("blocks lanes when changes are requested", () => {
    const workspace = createReadyForDecisionWorkspace();
    const agentId = workspace.agents[1]!.agent.id;
    const next = applyApprovalDecision(workspace, {
      actor: "Operator",
      agentId,
      createdAt: "2026-03-10T10:05:00.000Z",
      status: "changes-requested",
      comment: "Tighten the diff scope before approval."
    });

    const readiness = getMergeReadiness(next, agentId);

    expect(readiness.status).toBe("blocked");
    expect(readiness.blockedReasons).toContain("Operator requested changes before merge.");
    expect(next.agents.find((entry) => entry.agent.id === agentId)?.comments.at(-1)?.body).toContain(
      "Tighten the diff scope"
    );
  });
});
