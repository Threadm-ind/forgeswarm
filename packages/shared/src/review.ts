import type {
  ApprovalRecord,
  ApprovalStatus,
  CheckRunRecord,
  MergeQueueEntry,
  MergeReadinessStatus,
  WorkspaceCommentRecord,
  WorkspaceSession
} from "./domain";

function now(): string {
  return new Date().toISOString();
}

function createReviewComment(createdAt: string, summary: string, comment?: string): WorkspaceCommentRecord {
  return {
    id: `review-comment:${Math.random().toString(36).slice(2, 10)}`,
    author: "User",
    body: comment ? `${summary} ${comment}` : summary,
    createdAt
  };
}

function summarizeDecision(status: ApprovalStatus, approval: ApprovalRecord): string {
  if (status === "approved") {
    return `Operator approved ${approval.branchName} for supervised merge handling.`;
  }

  if (status === "rejected") {
    return `Operator rejected ${approval.branchName}; this lane will not advance to merge.`;
  }

  return `Operator requested changes on ${approval.branchName} before merge can proceed.`;
}

export function getWorkspaceGateChecks(workspace: WorkspaceSession): CheckRunRecord[] {
  const testerLane = workspace.agents.find((entry) => entry.agent.role === "Tester" && entry.checks.length > 0);

  if (testerLane) {
    return testerLane.checks;
  }

  const reviewerLane = workspace.agents.find((entry) => entry.agent.role === "Reviewer" && entry.checks.length > 0);
  return reviewerLane?.checks ?? workspace.agents[0]?.checks ?? [];
}

export function getMergeReadiness(
  workspace: WorkspaceSession,
  agentId: string
): {
  blockedReasons: string[];
  readinessSummary: string;
  status: MergeReadinessStatus;
} {
  const lane = workspace.agents.find((entry) => entry.agent.id === agentId);

  if (!lane) {
    return {
      status: "blocked",
      readinessSummary: "Agent lane could not be resolved.",
      blockedReasons: ["The selected agent lane no longer exists in the workspace state."]
    };
  }

  const blockedReasons: string[] = [];
  const gateChecks = getWorkspaceGateChecks(workspace);
  const reviewerLane = workspace.agents.find((entry) => entry.agent.role === "Reviewer");
  const testerLane = workspace.agents.find((entry) => entry.agent.role === "Tester");

  if (lane.git.status === "error") {
    blockedReasons.push(lane.git.note);
  }

  if (lane.git.conflictState === "conflicted") {
    blockedReasons.push("Lane has unresolved merge conflicts.");
  }

  if (lane.diffSummary.filesChanged <= 0) {
    blockedReasons.push("No diff is available for operator review.");
  }

  if (lane.approval.status === "rejected") {
    blockedReasons.push("Operator rejected this lane.");
  }

  if (lane.approval.status === "changes-requested") {
    blockedReasons.push("Operator requested changes before merge.");
  }

  if (gateChecks.some((check) => check.status === "failed")) {
    blockedReasons.push("One or more validation checks failed.");
  }

  if (blockedReasons.length > 0) {
    return {
      status: "blocked",
      readinessSummary: blockedReasons[0] ?? "This lane is blocked from merge.",
      blockedReasons
    };
  }

  if (reviewerLane && reviewerLane.agent.status !== "completed") {
    return {
      status: "awaiting-checks",
      readinessSummary: "Reviewer gate has not cleared this lane yet.",
      blockedReasons
    };
  }

  if (testerLane && gateChecks.some((check) => check.status === "running" || check.status === "pending")) {
    return {
      status: "awaiting-checks",
      readinessSummary: "Tester lane is still progressing the configured merge gates.",
      blockedReasons
    };
  }

  if (lane.approval.status === "approved") {
    return {
      status: "ready",
      readinessSummary: "Approved and ready for an explicit supervised merge step.",
      blockedReasons: []
    };
  }

  return {
    status: "awaiting-decision",
    readinessSummary: "Checks are coherent. Waiting for an operator decision.",
    blockedReasons: []
  };
}

function readinessRank(status: MergeReadinessStatus): number {
  if (status === "awaiting-decision") {
    return 0;
  }

  if (status === "ready") {
    return 1;
  }

  if (status === "awaiting-checks") {
    return 2;
  }

  return 3;
}

export function deriveMergeQueueEntries(workspace: WorkspaceSession): MergeQueueEntry[] {
  const gateChecks = getWorkspaceGateChecks(workspace);

  return workspace.agents
    .map((entry) => {
      const readiness = getMergeReadiness(workspace, entry.agent.id);

      return {
        id: `queue:${entry.agent.id}`,
        agentId: entry.agent.id,
        agentName: entry.agent.name,
        agentRole: entry.agent.role,
        branchName: entry.git.branchName,
        worktreePath: entry.git.worktreePath,
        strategy: entry.git.strategy,
        isolationStatus: entry.git.status,
        conflictState: entry.git.conflictState,
        diffSummary: entry.diffSummary,
        diffFiles: entry.diffFiles,
        diffSections: entry.diffSections,
        checks: gateChecks,
        approval: entry.approval,
        mergeReadiness: readiness.status,
        readinessSummary: readiness.readinessSummary,
        blockedReasons: readiness.blockedReasons
      };
    })
    .sort((left, right) => {
      const rankDelta = readinessRank(left.mergeReadiness) - readinessRank(right.mergeReadiness);
      if (rankDelta !== 0) {
        return rankDelta;
      }

      return left.agentName.localeCompare(right.agentName);
    });
}

export function findMergeQueueEntry(workspace: WorkspaceSession, agentId: string): MergeQueueEntry | null {
  return deriveMergeQueueEntries(workspace).find((entry) => entry.agentId === agentId) ?? null;
}

export function applyApprovalDecision(
  workspace: WorkspaceSession,
  input: {
    actor: NonNullable<ApprovalRecord["decidedBy"]>;
    agentId: string;
    comment?: string;
    createdAt?: string;
    status: ApprovalStatus;
    summary?: string;
  }
): WorkspaceSession {
  const createdAt = input.createdAt ?? now();
  const agent = workspace.agents.find((entry) => entry.agent.id === input.agentId);
  const summary = input.summary ?? (agent ? summarizeDecision(input.status, agent.approval) : "Operator recorded a review decision.");

  return {
    ...workspace,
    globalTimeline: [
      ...workspace.globalTimeline,
      {
        id: `timeline:review:${input.agentId}:${workspace.globalTimeline.length + 1}`,
        timestamp: createdAt,
        title: "Review decision recorded",
        detail: summary,
        tone: input.status === "approved" ? "success" : "warning"
      }
    ],
    messages: [
      ...workspace.messages,
      {
        id: `${workspace.id}:message:review:${input.agentId}:${workspace.messages.length + 1}`,
        swarmId: workspace.agents[0]?.agent.swarmId ?? workspace.id,
        agentId: input.agentId,
        direction: "user",
        authorLabel: input.actor,
        recipientLabel: agent?.agent.name ?? null,
        body: summary,
        createdAt
      }
    ],
    agents: workspace.agents.map((entry) => {
      if (entry.agent.id !== input.agentId) {
        return entry;
      }

      return {
        ...entry,
        approval: {
          ...entry.approval,
          status: input.status,
          decidedAt: createdAt,
          decidedBy: input.actor,
          summary,
          comment: input.comment ?? entry.approval.comment,
          auditTrail: [
            ...entry.approval.auditTrail,
            {
              id: `${entry.approval.id}:audit:${entry.approval.auditTrail.length + 1}`,
              createdAt,
              actor: input.actor,
              action: input.status,
              summary
            }
          ]
        },
        comments: [...entry.comments, createReviewComment(createdAt, summary, input.comment)]
      };
    })
  };
}
