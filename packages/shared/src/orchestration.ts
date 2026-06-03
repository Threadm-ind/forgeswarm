import type {
  AgentStatus,
  CheckRunRecord,
  CoordinatorPlanItem,
  DiffSummaryRecord,
  MessageRecord,
  OrchestrationStage,
  RollCallAgentStatusRecord,
  SwarmRollCallRecord,
  SwarmStatus,
  TaskRecord,
  TerminalLineRecord,
  TimelineEventRecord,
  WorkspaceAgentSession,
  WorkspaceSession
} from "./domain";
import { normalizeWorkspaceSession } from "./workspace";

export type OrchestrationEvent =
  | {
      id: string;
      workspaceId: string;
      timestamp: string;
      kind: "swarm.started";
      payload: {
        stage: OrchestrationStage;
        summary: string;
      };
    }
  | {
      id: string;
      workspaceId: string;
      timestamp: string;
      kind: "swarm.status.changed";
      payload: {
        status: SwarmStatus;
        summary: string;
      };
    }
  | {
      id: string;
      workspaceId: string;
      timestamp: string;
      kind: "stage.changed";
      payload: {
        stage: OrchestrationStage;
      };
    }
  | {
      id: string;
      workspaceId: string;
      timestamp: string;
      kind: "plan.step.updated";
      payload: {
        planItemId: string;
        status: CoordinatorPlanItem["status"];
        note: string;
      };
    }
  | {
      id: string;
      workspaceId: string;
      agentId: string;
      timestamp: string;
      kind: "agent.status.changed";
      payload: {
        status: AgentStatus;
        reason: string;
      };
    }
  | {
      id: string;
      workspaceId: string;
      agentId: string;
      timestamp: string;
      kind: "task.updated";
      payload: {
        taskId: string;
        status: TaskRecord["status"];
        summary: string;
      };
    }
  | {
      id: string;
      workspaceId: string;
      agentId: string;
      timestamp: string;
      kind: "terminal.line.added";
      payload: {
        line: TerminalLineRecord;
      };
    }
  | {
      id: string;
      workspaceId: string;
      timestamp: string;
      kind: "timeline.event";
      payload: {
        scope: "global" | "agent";
        event: TimelineEventRecord;
      };
    }
  | {
      id: string;
      workspaceId: string;
      timestamp: string;
      kind: "message.logged";
      payload: {
        message: MessageRecord;
      };
    }
  | {
      id: string;
      workspaceId: string;
      agentId: string;
      timestamp: string;
      kind: "check.updated";
      payload: {
        checkId: string;
        status: CheckRunRecord["status"];
        summary: string;
      };
    }
  | {
      id: string;
      workspaceId: string;
      agentId: string;
      timestamp: string;
      kind: "diff.updated";
      payload: Partial<Pick<DiffSummaryRecord, "title" | "summary" | "filesChanged" | "additions" | "deletions">>;
    }
  | {
      id: string;
      workspaceId: string;
      timestamp: string;
      kind: "rollcall.started";
      payload: {
        rollCall: SwarmRollCallRecord;
      };
    }
  | {
      id: string;
      workspaceId: string;
      timestamp: string;
      kind: "rollcall.completed";
      payload: {
        rollCall: SwarmRollCallRecord;
      };
    };

const MAX_GLOBAL_TIMELINE = 18;
const MAX_AGENT_TIMELINE = 12;
const MAX_TERMINAL_LINES = 16;
const MAX_MESSAGES = 18;

function limitTail<T>(items: T[], max: number): T[] {
  return items.slice(-max);
}

function updateAgentSession(
  workspace: WorkspaceSession,
  agentId: string,
  updater: (agent: WorkspaceAgentSession) => WorkspaceAgentSession
): WorkspaceSession {
  return {
    ...workspace,
    agents: workspace.agents.map((entry) => (entry.agent.id === agentId ? updater(entry) : entry))
  };
}

function updateTaskStatus(tasks: TaskRecord[], taskId: string, status: TaskRecord["status"], summary: string) {
  return tasks.map((task) => (task.id === taskId ? { ...task, status, summary } : task));
}

function updateCheckStatus(checks: CheckRunRecord[], checkId: string, status: CheckRunRecord["status"], summary: string) {
  return checks.map((check) => (check.id === checkId ? { ...check, status, summary } : check));
}

function appendTimeline(
  workspace: WorkspaceSession,
  event: TimelineEventRecord,
  scope: "global" | "agent"
): WorkspaceSession {
  if (scope === "agent" && event.agentId) {
    return updateAgentSession(workspace, event.agentId, (agent) => ({
      ...agent,
      timeline: limitTail(agent.timeline.concat(event), MAX_AGENT_TIMELINE)
    }));
  }

  return {
    ...workspace,
    globalTimeline: limitTail(workspace.globalTimeline.concat(event), MAX_GLOBAL_TIMELINE)
  };
}

function appendMessage(workspace: WorkspaceSession, message: MessageRecord): WorkspaceSession {
  return {
    ...workspace,
    messages: limitTail(workspace.messages.concat(message), MAX_MESSAGES)
  };
}

function applyRollCall(workspace: WorkspaceSession, rollCall: SwarmRollCallRecord): WorkspaceSession {
  return {
    ...workspace,
    lastRollCall: rollCall
  };
}

export function createRollCallSummary(agentStatuses: RollCallAgentStatusRecord[]): string {
  const grouped = agentStatuses.reduce<Record<string, number>>((accumulator, status) => {
    accumulator[status.status] = (accumulator[status.status] ?? 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(grouped)
    .map(([status, count]) => `${count} ${status}`)
    .join(", ");
}

export function applyOrchestrationEvent(workspace: WorkspaceSession, event: OrchestrationEvent): WorkspaceSession {
  const normalized = normalizeWorkspaceSession(workspace);

  if (!normalized || normalized.id !== event.workspaceId) {
    return workspace;
  }

  switch (event.kind) {
    case "swarm.started":
      return {
        ...normalized,
        status: "running",
        orchestrationStage: event.payload.stage
      };

    case "swarm.status.changed":
      return {
        ...normalized,
        status: event.payload.status
      };

    case "stage.changed":
      return {
        ...normalized,
        orchestrationStage: event.payload.stage
      };

    case "plan.step.updated":
      return {
        ...normalized,
        coordinatorPlan: normalized.coordinatorPlan.map((item) =>
          item.id === event.payload.planItemId
            ? { ...item, status: event.payload.status, note: event.payload.note }
            : item
        )
      };

    case "agent.status.changed":
      return updateAgentSession(normalized, event.agentId, (agent) => ({
        ...agent,
        agent: {
          ...agent.agent,
          status: event.payload.status
        }
      }));

    case "task.updated":
      return updateAgentSession(normalized, event.agentId, (agent) => ({
        ...agent,
        tasks: updateTaskStatus(agent.tasks, event.payload.taskId, event.payload.status, event.payload.summary)
      }));

    case "terminal.line.added":
      return updateAgentSession(normalized, event.agentId, (agent) => ({
        ...agent,
        terminal: {
          ...agent.terminal,
          lines: limitTail(agent.terminal.lines.concat(event.payload.line), MAX_TERMINAL_LINES)
        }
      }));

    case "timeline.event":
      return appendTimeline(normalized, event.payload.event, event.payload.scope);

    case "message.logged":
      return appendMessage(normalized, event.payload.message);

    case "check.updated":
      return updateAgentSession(normalized, event.agentId, (agent) => ({
        ...agent,
        checks: updateCheckStatus(agent.checks, event.payload.checkId, event.payload.status, event.payload.summary)
      }));

    case "diff.updated":
      return updateAgentSession(normalized, event.agentId, (agent) => ({
        ...agent,
        diffSummary: {
          ...agent.diffSummary,
          ...event.payload
        }
      }));

    case "rollcall.started":
      return applyRollCall(normalized, event.payload.rollCall);

    case "rollcall.completed":
      return applyRollCall(normalized, event.payload.rollCall);

    default:
      return normalized;
  }
}

export function applyOrchestrationEvents(
  workspace: WorkspaceSession,
  events: OrchestrationEvent[]
): WorkspaceSession {
  return events.reduce(applyOrchestrationEvent, workspace);
}
