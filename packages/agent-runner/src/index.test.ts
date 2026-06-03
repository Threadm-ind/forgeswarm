import { afterEach, describe, expect, it, vi } from "vitest";

import { createDefaultSwarmDraft, createMockWorkspaceSession } from "@forgeswarm/shared";

import { MockSwarmOrchestrator } from "./index";

const repository = {
  path: "C:/dev/forgeswarm",
  name: "forgeswarm",
  branch: "main",
  validationState: "valid" as const,
  stackBadges: [{ label: "React", confidence: "detected" as const }],
  detectedFiles: ["package.json"],
  issues: []
};

describe("MockSwarmOrchestrator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits a deterministic staged swarm flow through review readiness", () => {
    vi.useFakeTimers();

    const orchestrator = new MockSwarmOrchestrator();
    const session = createMockWorkspaceSession(repository, createDefaultSwarmDraft(4));
    const events: string[] = [];

    orchestrator.subscribe((event) => {
      events.push(event.kind === "stage.changed" ? `${event.kind}:${event.payload.stage}` : event.kind);
    });

    orchestrator.start(session);
    vi.runAllTimers();

    expect(events).toContain("swarm.started");
    expect(events).toContain("stage.changed:scouting");
    expect(events).toContain("stage.changed:building");
    expect(events).toContain("stage.changed:reviewing");
    expect(events).toContain("stage.changed:testing");
    expect(events).toContain("stage.changed:awaiting-approval");
    expect(events).toContain("swarm.status.changed");
  });

  it("handles lifecycle commands, direct messaging, and roll call", async () => {
    vi.useFakeTimers();

    const orchestrator = new MockSwarmOrchestrator();
    const session = createMockWorkspaceSession(repository, createDefaultSwarmDraft(4));
    const builder = session.agents.find((entry) => entry.agent.role === "Builder")!;
    const events: string[] = [];

    orchestrator.subscribe((event) => {
      if (event.kind === "agent.status.changed") {
        events.push(`${event.kind}:${event.payload.status}`);
        return;
      }

      events.push(event.kind);
    });

    orchestrator.start(session);
    await orchestrator.dispatch({ type: "pause", agentId: builder.agent.id });
    await orchestrator.dispatch({ type: "resume", agentId: builder.agent.id });
    await orchestrator.dispatch({ type: "message", agentId: builder.agent.id, body: "Keep the diff tight." });
    await orchestrator.dispatch({ type: "run-roll-call" });
    vi.runAllTimers();

    expect(events).toContain("agent.status.changed:paused");
    expect(events).toContain("agent.status.changed:waiting");
    expect(events).toContain("message.logged");
    expect(events).toContain("rollcall.started");
    expect(events).toContain("rollcall.completed");
  });
});
