import { describe, expect, it } from "vitest";

import {
  createDefaultAppSettings,
  createDefaultPersistedAppState,
  createDemoPersistedAppState,
  normalizeAppSettings,
  normalizePersistedAppState,
  upsertRecentRepositories
} from "./app-storage";

describe("app storage helpers", () => {
  it("creates a seeded demo state that opens into the workspace", () => {
    const state = createDemoPersistedAppState();

    expect(state.lastScreen).toBe("Workspace");
    expect(state.workspaceSession?.agents.length).toBeGreaterThan(0);
    expect(state.selectedRepositoryInspection?.validationState).toBe("valid");
    expect(state.workspaceSession?.gitIsolation?.status).toBe("ready");
    expect(state.workspaceSession?.agents[0]?.approval.status).toBe("pending");
  });

  it("normalizes incomplete persisted state safely", () => {
    const normalized = normalizePersistedAppState({
      lastScreen: "Workspace",
      workspaceSession: null
    });

    expect(normalized.lastScreen).toBe("Home");
    expect(normalized.recentRepositories.length).toBeGreaterThan(0);
  });

  it("promotes the latest inspected repository to the front of recents", () => {
    const defaults = createDefaultPersistedAppState();
    const promoted = upsertRecentRepositories(defaults.recentRepositories, {
      path: "C:/dev/new-repo",
      name: "new-repo",
      branch: "main",
      validationState: "valid",
      stackBadges: [],
      detectedFiles: [],
      issues: []
    });

    expect(promoted[0]?.path).toBe("C:/dev/new-repo");
    expect(promoted).toHaveLength(Math.min(defaults.recentRepositories.length + 1, 8));
  });

  it("normalizes partial settings with stable defaults", () => {
    const normalized = normalizeAppSettings({
      appearance: "system",
      providerPlaceholder: "local-model"
    });

    expect(normalized.appearance).toBe("system");
    expect(normalized.providerPlaceholder).toBe("local-model");
    expect(normalized.keyboardShortcuts).toBe(createDefaultAppSettings().keyboardShortcuts);
    expect(normalized.repoPermissions).toBe(createDefaultAppSettings().repoPermissions);
  });
});
