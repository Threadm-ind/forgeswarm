import { invoke } from "@tauri-apps/api/core";
import {
  createRecentRepositoryRecord,
  normalizeStackBadges,
  type RecentRepositoryRecord,
  type RepositoryInspection
} from "@forgeswarm/shared";

const MOCK_INSPECTIONS: RepositoryInspection[] = [
  {
    path: "C:/workspace/forgeswarm",
    name: "Forgeswarm",
    branch: "main",
    validationState: "valid",
    stackBadges: normalizeStackBadges([
      { label: "Tauri v2", confidence: "detected" },
      { label: "React 19", confidence: "detected" },
      { label: "Tailwind CSS", confidence: "detected" },
      { label: "TypeScript", confidence: "detected" }
    ]),
    detectedFiles: ["package.json", "pnpm-workspace.yaml", "apps/desktop/src-tauri/Cargo.toml"],
    issues: []
  },
  {
    path: "C:/dev/forge-audit",
    name: "forge-audit",
    branch: "main",
    validationState: "valid",
    stackBadges: normalizeStackBadges([
      { label: "Node.js", confidence: "detected" },
      { label: "React", confidence: "detected" },
      { label: "TypeScript", confidence: "detected" }
    ]),
    detectedFiles: ["package.json", "tsconfig.json", "vite.config.ts"],
    issues: []
  },
  {
    path: "C:/dev/legacy-ops",
    name: "legacy-ops",
    branch: null,
    validationState: "missing-git",
    stackBadges: normalizeStackBadges([{ label: "Python", confidence: "inferred" }]),
    detectedFiles: ["pyproject.toml"],
    issues: [{ code: "missing-git", message: "Path exists but does not contain a Git repository." }]
  }
];

export const MOCK_RECENT_REPOSITORIES: RecentRepositoryRecord[] = MOCK_INSPECTIONS.map((inspection, index) => ({
  ...createRecentRepositoryRecord(inspection, index === 0 ? "recent" : "mock"),
  lastOpenedAt: new Date(Date.now() - index * 1000 * 60 * 45).toISOString()
}));

export async function pickRepositoryFolder(): Promise<string | null> {
  try {
    const dialog = await import("@tauri-apps/plugin-dialog");
    const selection = await dialog.open({
      directory: true,
      multiple: false,
      title: "Select a Git repository"
    });

    return typeof selection === "string" ? selection : null;
  } catch {
    return null;
  }
}

export async function inspectRepositoryPath(path: string): Promise<RepositoryInspection> {
  const normalizedPath = normalizePath(path);

  if (!normalizedPath) {
    return {
      path: "",
      name: "Unselected repository",
      branch: null,
      validationState: "missing-path",
      stackBadges: [],
      detectedFiles: [],
      issues: [{ code: "missing-path", message: "Enter or choose a repository path before validating." }]
    };
  }

  try {
    return await invoke<RepositoryInspection>("inspect_repository", { path: normalizedPath });
  } catch {
    return browserFallbackInspection(normalizedPath);
  }
}

export function browserFallbackInspection(path: string): RepositoryInspection {
  const normalizedPath = normalizePath(path).toLowerCase();
  const matched = MOCK_INSPECTIONS.find((inspection) => normalizePath(inspection.path).toLowerCase() === normalizedPath);

  if (matched) {
    return matched;
  }

  return {
    path: path.trim(),
    name: path.trim().split(/[\\/]/).pop() || "Selected repository",
    branch: null,
    validationState: "unsupported",
    stackBadges: [],
    detectedFiles: [],
    issues: [
      {
        code: "native-required",
        message:
          "Arbitrary local path inspection requires the Tauri shell. In browser mode, choose one of the seeded recent repositories or paste the ForgeSwarm workspace path."
      }
    ]
  };
}

function normalizePath(path: string): string {
  return path.trim().replace(/^"(.*)"$/, "$1");
}
