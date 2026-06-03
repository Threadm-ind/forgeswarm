export const AGENT_COUNT_OPTIONS = [2, 4, 6, 8] as const;

export const AGENT_ROLES = [
  "Coordinator",
  "Builder",
  "Scout",
  "Reviewer",
  "Tester"
] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];
export type AgentCount = (typeof AGENT_COUNT_OPTIONS)[number];
export type AppScreen = "Home" | "Swarm Setup" | "Workspace" | "Merge Queue" | "Settings";

export type RepositoryValidationState =
  | "idle"
  | "missing-path"
  | "valid"
  | "missing-git"
  | "unreadable"
  | "unsupported";

export type SwarmStatus =
  | "draft"
  | "configuring"
  | "running"
  | "paused"
  | "review"
  | "completed";

export type AgentStatus =
  | "idle"
  | "planning"
  | "running"
  | "waiting"
  | "paused"
  | "blocked"
  | "stopped"
  | "completed";

export type CheckStatus = "pending" | "running" | "passed" | "failed";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "changes-requested";
export type MergeReadinessStatus = "ready" | "blocked" | "awaiting-checks" | "awaiting-decision";
export type GitIsolationStrategy = "worktree" | "branch";
export type GitIsolationStatus = "planning" | "ready" | "warning" | "error";
export type GitConflictState = "clean" | "dirty" | "conflicted" | "unknown";
export type OrchestrationStage =
  | "idle"
  | "coordinating"
  | "scouting"
  | "building"
  | "reviewing"
  | "testing"
  | "awaiting-approval"
  | "halted";

export interface StackBadge {
  label: string;
  confidence: "detected" | "inferred";
}

export interface RepositoryValidationIssue {
  code: "missing-path" | "missing-git" | "unreadable" | "unsupported" | "native-required";
  message: string;
}

export interface RepositoryRecord {
  id: string;
  name: string;
  path: string;
  branch: string | null;
  validationState: RepositoryValidationState;
  stackBadges: StackBadge[];
  lastOpenedAt: string | null;
}

export interface RecentRepositoryRecord extends RepositoryRecord {
  source: "mock" | "recent" | "manual";
}

export interface RepositoryInspection {
  path: string;
  name: string;
  branch: string | null;
  validationState: RepositoryValidationState;
  stackBadges: StackBadge[];
  detectedFiles: string[];
  issues: RepositoryValidationIssue[];
}

export interface SwarmPreferences {
  autoRunTests: boolean;
  requireMergeApproval: boolean;
  allowFileWrites: boolean;
  allowTerminalCommands: boolean;
}

export interface SwarmDraft {
  prompt: string;
  agentCount: AgentCount;
  roles: AgentRole[];
  preferences: SwarmPreferences;
}

export interface SwarmRecord {
  id: string;
  repositoryId: string;
  title: string;
  prompt: string;
  agentCount: AgentCount;
  status: SwarmStatus;
  preferences: SwarmPreferences;
  createdAt: string;
}

export interface AgentRecord {
  id: string;
  swarmId: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  branchName: string;
  worktreePath: string;
  touchedFiles: string[];
}

export interface TaskRecord {
  id: string;
  swarmId: string;
  agentId?: string;
  title: string;
  status: "todo" | "running" | "blocked" | "done";
  summary: string;
}

export interface MessageRecord {
  id: string;
  swarmId: string;
  agentId?: string;
  direction: "user" | "agent" | "system";
  authorLabel: string;
  recipientLabel: string | null;
  body: string;
  createdAt: string;
}

export interface CheckRunRecord {
  id: string;
  swarmId: string;
  agentId?: string;
  name: string;
  status: CheckStatus;
  summary: string;
}

export interface ApprovalRecord {
  id: string;
  swarmId: string;
  agentId: string;
  branchName: string;
  status: ApprovalStatus;
  requestedByAgentId: string;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: "Operator" | "Coordinator" | "Reviewer" | "Tester" | null;
  summary: string;
  comment: string | null;
  auditTrail: ReviewAuditRecord[];
}

export interface CoordinatorPlanItem {
  id: string;
  title: string;
  status: "planned" | "in-progress" | "blocked" | "done";
  ownerRole: AgentRole;
  note: string;
}

export interface TimelineEventRecord {
  id: string;
  agentId?: string;
  timestamp: string;
  title: string;
  detail: string;
  tone: "neutral" | "info" | "success" | "warning";
}

export interface TerminalLineRecord {
  id: string;
  kind: "command" | "stdout" | "stderr" | "system";
  text: string;
}

export interface TerminalSessionRecord {
  id: string;
  agentId: string;
  title: string;
  cwd: string;
  lines: TerminalLineRecord[];
}

export interface TouchedFileRecord {
  path: string;
  changeType: "modified" | "created" | "deleted";
  agentId: string;
}

export interface DiffSummaryRecord {
  id: string;
  agentId: string;
  title: string;
  summary: string;
  filesChanged: number;
  additions: number;
  deletions: number;
}

export interface DiffFileRecord {
  path: string;
  changeType: TouchedFileRecord["changeType"];
  additions: number;
  deletions: number;
  note: string;
}

export interface DiffSectionRecord {
  id: string;
  title: string;
  summary: string;
  risk: "low" | "medium" | "high";
  files: string[];
}

export interface ReviewAuditRecord {
  id: string;
  createdAt: string;
  actor: "Operator" | "Coordinator" | "Reviewer" | "Tester";
  action: "queued" | ApprovalStatus | "merge-blocked";
  summary: string;
}

export interface WorkspaceCommentRecord {
  id: string;
  author: "Coordinator" | "Reviewer" | "User";
  body: string;
  createdAt: string;
}

export interface ProtectedBranchRecord {
  name: string;
  isProtected: boolean;
  currentBranch: string | null;
  detachedHead: boolean;
}

export interface GitRepositoryStatusRecord {
  repositoryPath: string;
  currentBranch: string | null;
  protectedBranch: string;
  supportsWorktrees: boolean;
  isDirty: boolean;
  hasConflicts: boolean;
  detachedHead: boolean;
  gitAvailable: boolean;
  warnings: string[];
  errors: string[];
}

export interface AgentGitSessionRecord {
  agentId: string;
  strategy: GitIsolationStrategy;
  branchName: string;
  worktreePath: string;
  baseBranch: string;
  status: GitIsolationStatus;
  conflictState: GitConflictState;
  exists: boolean;
  note: string;
  lastSyncedAt: string | null;
  resetAvailable: boolean;
  rollbackAvailable: boolean;
}

export interface GitIsolationPlanRecord {
  repositoryPath: string;
  strategy: GitIsolationStrategy;
  status: GitIsolationStatus;
  protectedBranch: ProtectedBranchRecord;
  repositoryStatus: GitRepositoryStatusRecord;
  warnings: string[];
  errors: string[];
  workspaces: AgentGitSessionRecord[];
}

export interface RollCallAgentStatusRecord {
  agentId: string;
  agentName: string;
  status: AgentStatus;
  note: string;
}

export interface SwarmRollCallRecord {
  id: string;
  requestedAt: string;
  completedAt: string | null;
  initiatedBy: "Coordinator" | "User";
  status: "running" | "completed";
  summary: string;
  agentStatuses: RollCallAgentStatusRecord[];
}

export interface WorkspaceAgentSession {
  agent: AgentRecord;
  git: AgentGitSessionRecord;
  terminal: TerminalSessionRecord;
  touchedFiles: TouchedFileRecord[];
  tasks: TaskRecord[];
  timeline: TimelineEventRecord[];
  diffSummary: DiffSummaryRecord;
  diffFiles: DiffFileRecord[];
  diffSections: DiffSectionRecord[];
  checks: CheckRunRecord[];
  approval: ApprovalRecord;
  comments: WorkspaceCommentRecord[];
}

export interface MergeQueueEntry {
  id: string;
  agentId: string;
  agentName: string;
  agentRole: AgentRole;
  branchName: string;
  worktreePath: string;
  strategy: GitIsolationStrategy;
  isolationStatus: GitIsolationStatus;
  conflictState: GitConflictState;
  diffSummary: DiffSummaryRecord;
  diffFiles: DiffFileRecord[];
  diffSections: DiffSectionRecord[];
  checks: CheckRunRecord[];
  approval: ApprovalRecord;
  mergeReadiness: MergeReadinessStatus;
  readinessSummary: string;
  blockedReasons: string[];
}

export interface WorkspaceSession {
  id: string;
  repository: RepositoryInspection;
  swarmDraft: SwarmDraft;
  status: SwarmStatus;
  orchestrationStage: OrchestrationStage;
  activeAgentId: string;
  coordinatorPlan: CoordinatorPlanItem[];
  globalTimeline: TimelineEventRecord[];
  messages: MessageRecord[];
  lastRollCall: SwarmRollCallRecord | null;
  gitIsolation: GitIsolationPlanRecord | null;
  agents: WorkspaceAgentSession[];
}

export interface AppSettingsRecord {
  appearance: "dark" | "system";
  keyboardShortcuts: "default" | "commander";
  providerPlaceholder: "mock-provider" | "openai-compatible" | "anthropic-compatible" | "local-model" | null;
  repoPermissions: "per-repo" | "session-only";
}

export interface PersistedAppState {
  recentRepositories: RecentRepositoryRecord[];
  selectedRepositoryInspection: RepositoryInspection | null;
  swarmDraft: SwarmDraft;
  workspaceSession: WorkspaceSession | null;
  pathDraft: string;
  lastScreen: AppScreen;
  settings: AppSettingsRecord;
}
