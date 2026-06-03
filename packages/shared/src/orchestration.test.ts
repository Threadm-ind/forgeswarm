import { describe, expect, it } from "vitest";

import { createDefaultSwarmDraft } from "./defaults";
import { applyOrchestrationEvents, normalizeWorkspaceSession } from "./index";
import { createMockWorkspaceSession } from "./workspace";

const repository = {
  path: "C:/dev/forgeswarm",
  name: "forgeswarm",
  branch: "main",
  validationState: "valid" as const,
  stackBadges: [{ label: "React", confidence: "detected" as const }],
  detectedFiles: ["package.json"],
  issues: []
};

describe("orchestration reducers", () => {
  it("applies staged orchestration events onto the workspace session", () => {
    const session = createMockWorkspaceSession(repository, createDefaultSwarmDraft(4));
    const builder = session.agents.find((entry) => entry.agent.role === "Builder")!;

    const next = applyOrchestrationEvents(session, [
      {
        id: "event:1",
        workspaceId: session.id,
        timestamp: new Date().toISOString(),
        kind: "stage.changed",
        payload: {
          stage: "building"
        }
      },
      {
        id: "event:2",
        workspaceId: session.id,
        agentId: builder.agent.id,
        timestamp: new Date().toISOString(),
        kind: "agent.status.changed",
        payload: {
          status: "running",
          reason: "Builder lane activated."
        }
      },
      {
        id: "event:3",
        workspaceId: session.id,
        timestamp: new Date().toISOString(),
        kind: "message.logged",
        payload: {
          message: {
            id: "message:1",
            swarmId: builder.agent.swarmId,
            agentId: builder.agent.id,
            direction: "agent",
            authorLabel: builder.agent.name,
            recipientLabel: "Operator",
            body: "Builder has started the scoped implementation pass.",
            createdAt: new Date().toISOString()
          }
        }
      },
      {
        id: "event:4",
        workspaceId: session.id,
        timestamp: new Date().toISOString(),
        kind: "rollcall.completed",
        payload: {
          rollCall: {
            id: "rollcall:1",
            requestedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            initiatedBy: "Coordinator",
            status: "completed",
            summary: "Roll call complete: 1 running, 3 waiting.",
            agentStatuses: session.agents.map((entry) => ({
              agentId: entry.agent.id,
              agentName: entry.agent.name,
              status: entry.agent.id === builder.agent.id ? "running" : entry.agent.status,
              note: `${entry.agent.name} responded to roll call.`
            }))
          }
        }
      }
    ]);

    expect(next.orchestrationStage).toBe("building");
    expect(next.messages.at(-1)?.body).toContain("Builder has started");
    expect(next.lastRollCall?.status).toBe("completed");
    expect(next.agents.find((entry) => entry.agent.id === builder.agent.id)?.agent.status).toBe("running");
  });

  it("normalizes legacy workspace sessions that lack orchestration fields", () => {
    const session = createMockWorkspaceSession(repository, createDefaultSwarmDraft(4));
    const legacySession = {
      ...session,
      messages: undefined,
      lastRollCall: undefined,
      orchestrationStage: undefined
    } as unknown as typeof session;

    const normalized = normalizeWorkspaceSession(legacySession);

    expect(normalized?.messages).toEqual([]);
    expect(normalized?.lastRollCall).toBeNull();
    expect(normalized?.orchestrationStage).toBe("scouting");
  });
});
