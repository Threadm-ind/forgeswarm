import { describe, expect, it } from "vitest";

import {
  createDefaultPreferences,
  createDefaultRoster,
  createDefaultSwarmDraft,
  createRecentRepositoryRecord,
  createRepositoryLabel,
  normalizeStackBadges
} from "./defaults";

describe("shared defaults", () => {
  it("creates a roster that always includes a builder", () => {
    expect(createDefaultRoster(2)).toEqual(["Coordinator", "Builder"]);
    expect(createDefaultRoster(4)).toContain("Builder");
    expect(createDefaultRoster(8).filter((role) => role === "Builder")).toHaveLength(4);
  });

  it("enables merge safety defaults", () => {
    expect(createDefaultPreferences()).toMatchObject({
      autoRunTests: true,
      requireMergeApproval: true
    });
  });

  it("formats repository labels with branch context", () => {
    expect(createRepositoryLabel({ name: "forgeswarm", branch: "main" })).toBe(
      "forgeswarm (main)"
    );
    expect(createRepositoryLabel({ name: "sandbox", branch: null })).toBe("sandbox");
  });

  it("creates a default swarm draft from the selected agent count", () => {
    const draft = createDefaultSwarmDraft(6);

    expect(draft.agentCount).toBe(6);
    expect(draft.roles).toHaveLength(6);
    expect(draft.preferences.requireMergeApproval).toBe(true);
  });

  it("normalizes stack badges and recent repository records", () => {
    expect(
      normalizeStackBadges([
        { label: "React", confidence: "detected" },
        { label: "react", confidence: "inferred" },
        { label: "Tauri", confidence: "detected" }
      ])
    ).toHaveLength(2);

    expect(
      createRecentRepositoryRecord(
        {
          path: "C:/dev/forgeswarm",
          name: "forgeswarm",
          branch: "main",
          validationState: "valid",
          stackBadges: [{ label: "React", confidence: "detected" }],
          detectedFiles: ["package.json"],
          issues: []
        },
        "mock"
      )
    ).toMatchObject({
      name: "forgeswarm",
      source: "mock",
      validationState: "valid"
    });
  });
});
