import type {
  AgentCount,
  AgentRole,
  RecentRepositoryRecord,
  RepositoryInspection,
  RepositoryRecord,
  StackBadge,
  SwarmDraft,
  SwarmPreferences
} from "./domain";

export function createDefaultPreferences(): SwarmPreferences {
  return {
    autoRunTests: true,
    requireMergeApproval: true,
    allowFileWrites: true,
    allowTerminalCommands: true
  };
}

export function createDefaultRoster(agentCount: AgentCount): AgentRole[] {
  const priority: AgentRole[] = ["Coordinator", "Builder", "Scout", "Reviewer", "Tester"];
  const roster = priority.slice(0, Math.min(agentCount, priority.length));

  while (roster.length < agentCount) {
    roster.push("Builder");
  }

  return roster;
}

export function createRepositoryLabel(repository: Pick<RepositoryRecord, "name" | "branch">): string {
  return repository.branch ? `${repository.name} (${repository.branch})` : repository.name;
}

export function createDefaultSwarmDraft(agentCount: AgentCount = 4): SwarmDraft {
  return {
    prompt: "",
    agentCount,
    roles: createDefaultRoster(agentCount),
    preferences: createDefaultPreferences()
  };
}

export function normalizeStackBadges(stackBadges: StackBadge[]): StackBadge[] {
  const seen = new Set<string>();
  const normalized: StackBadge[] = [];

  for (const badge of stackBadges) {
    const key = badge.label.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push(badge);
    }
  }

  return normalized;
}

export function createRecentRepositoryRecord(
  inspection: RepositoryInspection,
  source: RecentRepositoryRecord["source"] = "manual"
): RecentRepositoryRecord {
  return {
    id: `${source}:${inspection.path}`,
    name: inspection.name,
    path: inspection.path,
    branch: inspection.branch,
    validationState: inspection.validationState,
    stackBadges: normalizeStackBadges(inspection.stackBadges),
    lastOpenedAt: new Date().toISOString(),
    source
  };
}
