import { invoke } from "@tauri-apps/api/core";
import { createDemoWorkspaceWithGit } from "./git-isolation";
import {
  createDefaultSwarmDraft,
  createMockWorkspaceSession,
  createRecentRepositoryRecord,
  normalizeWorkspaceSession,
  type AppSettingsRecord,
  type AppScreen,
  type PersistedAppState,
  type RecentRepositoryRecord,
  type RepositoryInspection
} from "@forgeswarm/shared";

import { MOCK_RECENT_REPOSITORIES } from "./repository-service";

const STORAGE_KEY = "forgeswarm.app-state.v1";
const DEMO_REPOSITORY_PATH = "C:/workspace/forgeswarm";

export function createDefaultAppSettings(): AppSettingsRecord {
  return {
    appearance: "dark",
    keyboardShortcuts: "default",
    providerPlaceholder: "mock-provider",
    repoPermissions: "per-repo"
  };
}

export function normalizeAppSettings(
  settings: Partial<AppSettingsRecord> | null | undefined
): AppSettingsRecord {
  const defaults = createDefaultAppSettings();

  return {
    appearance: settings?.appearance ?? defaults.appearance,
    keyboardShortcuts: settings?.keyboardShortcuts ?? defaults.keyboardShortcuts,
    providerPlaceholder: settings?.providerPlaceholder ?? defaults.providerPlaceholder,
    repoPermissions: settings?.repoPermissions ?? defaults.repoPermissions
  };
}

export function createDefaultPersistedAppState(): PersistedAppState {
  return {
    recentRepositories: MOCK_RECENT_REPOSITORIES,
    selectedRepositoryInspection: null,
    swarmDraft: createDefaultSwarmDraft(4),
    workspaceSession: null,
    pathDraft: MOCK_RECENT_REPOSITORIES[0]?.path ?? "",
    lastScreen: "Home",
    settings: createDefaultAppSettings()
  };
}

export function createDemoPersistedAppState(): PersistedAppState {
  const inspection = {
    path: DEMO_REPOSITORY_PATH,
    name: "ForgeSwarm",
    branch: "main",
    validationState: "valid",
    stackBadges: [
      { label: "Tauri v2", confidence: "detected" },
      { label: "React 19", confidence: "detected" },
      { label: "Tailwind CSS", confidence: "detected" },
      { label: "TypeScript", confidence: "detected" }
    ],
    detectedFiles: ["package.json", "pnpm-workspace.yaml", "apps/desktop/src-tauri/Cargo.toml"],
    issues: []
  } satisfies RepositoryInspection;

  const swarmDraft = {
    ...createDefaultSwarmDraft(6),
    prompt:
      "Demonstrate a supervised multi-agent coding workspace with visible agent lanes, review-first merge controls, and protected main branch behavior."
  };

  return {
    recentRepositories: upsertRecentRepositories(MOCK_RECENT_REPOSITORIES, inspection, "recent"),
    selectedRepositoryInspection: inspection,
    swarmDraft,
    workspaceSession: createDemoWorkspaceWithGit(createMockWorkspaceSession(inspection, swarmDraft)),
    pathDraft: inspection.path,
    lastScreen: "Workspace",
    settings: createDefaultAppSettings()
  };
}

export function upsertRecentRepositories(
  repositories: RecentRepositoryRecord[],
  inspection: RepositoryInspection,
  source: RecentRepositoryRecord["source"] = "manual"
): RecentRepositoryRecord[] {
  const nextRecord = createRecentRepositoryRecord(inspection, source);

  return [
    nextRecord,
    ...repositories.filter((repository) => repository.path.toLowerCase() !== inspection.path.toLowerCase())
  ].slice(0, 8);
}

export function normalizePersistedAppState(
  state: Partial<PersistedAppState> | null | undefined
): PersistedAppState {
  const defaults = createDefaultPersistedAppState();

  const normalized: PersistedAppState = {
    recentRepositories:
      state?.recentRepositories && state.recentRepositories.length > 0 ? state.recentRepositories : defaults.recentRepositories,
    selectedRepositoryInspection: state?.selectedRepositoryInspection ?? defaults.selectedRepositoryInspection,
    swarmDraft: state?.swarmDraft ?? defaults.swarmDraft,
    workspaceSession: normalizeWorkspaceSession(state?.workspaceSession ?? defaults.workspaceSession),
    pathDraft:
      state?.pathDraft ??
      state?.selectedRepositoryInspection?.path ??
      state?.recentRepositories?.[0]?.path ??
      defaults.pathDraft,
    lastScreen: (state?.lastScreen as AppScreen | undefined) ?? defaults.lastScreen,
    settings: normalizeAppSettings(state?.settings ?? defaults.settings)
  };

  if (normalized.lastScreen === "Workspace" && !normalized.workspaceSession) {
    normalized.lastScreen = normalized.selectedRepositoryInspection ? "Swarm Setup" : "Home";
  }

  if (normalized.lastScreen === "Swarm Setup" && !normalized.selectedRepositoryInspection) {
    normalized.lastScreen = "Home";
  }

  return normalized;
}

export async function loadAppState(): Promise<PersistedAppState> {
  try {
    const state = await invoke<PersistedAppState | null>("load_app_state");
    return normalizePersistedAppState(state);
  } catch {
    return loadFromLocalStorage();
  }
}

export async function saveAppState(state: PersistedAppState): Promise<void> {
  const normalized = normalizePersistedAppState(state);

  try {
    await invoke("save_app_state", { state: normalized });
  } catch {
    saveToLocalStorage(normalized);
  }
}

function loadFromLocalStorage(): PersistedAppState {
  if (typeof window === "undefined") {
    return createDefaultPersistedAppState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizePersistedAppState(JSON.parse(raw) as Partial<PersistedAppState>) : createDefaultPersistedAppState();
  } catch {
    return createDefaultPersistedAppState();
  }
}

function saveToLocalStorage(state: PersistedAppState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
