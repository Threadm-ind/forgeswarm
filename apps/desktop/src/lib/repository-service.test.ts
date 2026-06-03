import { describe, expect, it } from "vitest";

import { MOCK_RECENT_REPOSITORIES, browserFallbackInspection } from "./repository-service";

describe("repository service", () => {
  it("returns seeded fallback inspections for known browser paths", () => {
    const inspection = browserFallbackInspection("C:/workspace/forgeswarm");

    expect(inspection.validationState).toBe("valid");
    expect(inspection.stackBadges.length).toBeGreaterThan(0);
  });

  it("surfaces native-shell requirements for unknown browser paths", () => {
    const inspection = browserFallbackInspection("C:/workspace/unknown-repo");

    expect(inspection.validationState).toBe("unsupported");
    expect(inspection.issues[0]?.code).toBe("native-required");
  });

  it("seeds recent repositories for the Home screen", () => {
    expect(MOCK_RECENT_REPOSITORIES.length).toBeGreaterThanOrEqual(3);
    expect(MOCK_RECENT_REPOSITORIES[0]?.path).toContain("Forgeswarm");
  });
});
