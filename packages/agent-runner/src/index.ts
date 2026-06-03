import {
  createRollCallSummary,
  type AgentRole,
  type AgentStatus,
  type MessageRecord,
  type OrchestrationEvent,
  type RollCallAgentStatusRecord,
  type SwarmRollCallRecord,
  type TerminalLineRecord,
  type TimelineEventRecord,
  type WorkspaceAgentSession,
  type WorkspaceSession
} from "@forgeswarm/shared";

export type SwarmCommand =
  | {
      type: "pause" | "resume" | "stop";
      agentId: string;
    }
  | {
      type: "message";
      agentId: string;
      body: string;
    }
  | {
      type: "run-roll-call";
    };

export interface SwarmOrchestrator {
  start(workspace: WorkspaceSession): void;
  dispatch(command: SwarmCommand): Promise<void>;
  subscribe(listener: (event: OrchestrationEvent) => void): () => void;
  dispose(): void;
}

export class MockSwarmOrchestrator implements SwarmOrchestrator {
  private listeners = new Set<(event: OrchestrationEvent) => void>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private currentWorkspace: WorkspaceSession | null = null;
  private eventSequence = 0;
  private currentStatuses = new Map<string, AgentStatus>();
  private previousStatuses = new Map<string, AgentStatus>();

  start(workspace: WorkspaceSession): void {
    this.clearTimers();
    this.currentWorkspace = workspace;
    this.eventSequence = 0;
    this.currentStatuses = new Map(workspace.agents.map((entry) => [entry.agent.id, entry.agent.status]));
    this.previousStatuses = new Map(workspace.agents.map((entry) => [entry.agent.id, entry.agent.status]));

    if (workspace.messages.length > 3 || workspace.orchestrationStage !== "coordinating") {
      return;
    }

    this.queueBootstrapSequence();
  }

  async dispatch(command: SwarmCommand): Promise<void> {
    const workspace = this.currentWorkspace;

    if (!workspace) {
      return;
    }

    if (command.type === "run-roll-call") {
      this.runRollCall("User");
      return;
    }

    const agent = this.findAgentById(command.agentId);

    if (!agent) {
      return;
    }

    if (command.type === "pause" && this.currentStatuses.get(agent.agent.id) !== "stopped") {
      const currentStatus = this.currentStatuses.get(agent.agent.id) ?? agent.agent.status;
      if (currentStatus !== "paused") {
        this.previousStatuses.set(agent.agent.id, currentStatus);
      }

      this.setAgentStatus(agent.agent.id, "paused");
      this.emitBatch([
        this.agentStatusChanged(agent.agent.id, "paused", "Operator paused this lane."),
        this.timelineEvent("agent", {
          id: `${agent.agent.id}:timeline:pause`,
          agentId: agent.agent.id,
          timestamp: this.now(),
          title: "Lane paused",
          detail: `${agent.agent.name} is paused by the operator.`,
          tone: "warning"
        }),
        this.terminalLine(agent.agent.id, {
          id: `${agent.agent.id}:terminal:pause`,
          kind: "system",
          text: "> Lane paused by operator."
        })
      ]);
      return;
    }

    if (command.type === "resume") {
      const resumedStatus = this.previousStatuses.get(agent.agent.id) ?? "running";
      this.setAgentStatus(agent.agent.id, resumedStatus);
      this.emitBatch([
        this.agentStatusChanged(agent.agent.id, resumedStatus, "Operator resumed this lane."),
        this.timelineEvent("agent", {
          id: `${agent.agent.id}:timeline:resume`,
          agentId: agent.agent.id,
          timestamp: this.now(),
          title: "Lane resumed",
          detail: `${agent.agent.name} resumed work in mock orchestration mode.`,
          tone: "success"
        }),
        this.terminalLine(agent.agent.id, {
          id: `${agent.agent.id}:terminal:resume`,
          kind: "system",
          text: "> Lane resumed by operator."
        })
      ]);
      return;
    }

    if (command.type === "stop") {
      this.setAgentStatus(agent.agent.id, "stopped");
      this.emitBatch([
        this.agentStatusChanged(agent.agent.id, "stopped", "Operator stopped this lane."),
        ...agent.tasks
          .filter((task) => task.status === "running")
          .map((task) =>
            this.taskUpdated(agent.agent.id, task.id, "blocked", "Task halted because the operator stopped this lane.")
          ),
        this.timelineEvent("agent", {
          id: `${agent.agent.id}:timeline:stop`,
          agentId: agent.agent.id,
          timestamp: this.now(),
          title: "Lane stopped",
          detail: `${agent.agent.name} has been stopped and will not auto-advance further.`,
          tone: "warning"
        }),
        this.terminalLine(agent.agent.id, {
          id: `${agent.agent.id}:terminal:stop`,
          kind: "system",
          text: "> Lane stopped. Awaiting a new workspace run."
        })
      ]);
      return;
    }

    if (command.type === "message") {
      const userMessage = this.messageLogged({
        id: `${workspace.id}:message:user:${this.nextId("message")}`,
        swarmId: this.swarmId(),
        agentId: agent.agent.id,
        direction: "user",
        authorLabel: "Operator",
        recipientLabel: agent.agent.name,
        body: command.body.trim(),
        createdAt: this.now()
      });

      this.emitBatch([
        userMessage,
        this.terminalLine(agent.agent.id, {
          id: `${agent.agent.id}:terminal:operator-note:${this.nextId("terminal")}`,
          kind: "system",
          text: `> Operator note received: ${command.body.trim()}`
        })
      ]);

      this.schedule(220, () => {
        if (!this.canAdvance(agent.agent.id)) {
          return;
        }

        this.emitBatch([
          this.messageLogged({
            id: `${workspace.id}:message:reply:${this.nextId("message")}`,
            swarmId: this.swarmId(),
            agentId: agent.agent.id,
            direction: "agent",
            authorLabel: agent.agent.name,
            recipientLabel: "Operator",
            body: this.buildAgentReply(agent),
            createdAt: this.now()
          }),
          this.timelineEvent("agent", {
            id: `${agent.agent.id}:timeline:reply:${this.nextId("timeline")}`,
            agentId: agent.agent.id,
            timestamp: this.now(),
            title: "Operator message handled",
            detail: `${agent.agent.name} acknowledged the latest operator instruction.`,
            tone: "info"
          })
        ]);
      });
    }
  }

  subscribe(listener: (event: OrchestrationEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.clearTimers();
    this.currentWorkspace = null;
    this.currentStatuses.clear();
    this.previousStatuses.clear();
  }

  private queueBootstrapSequence() {
    const coordinator = this.pickLaneAgent("Coordinator");
    const scout = this.pickLaneAgent("Scout", ["Coordinator"]);
    const reviewer = this.pickLaneAgent("Reviewer", ["Coordinator"]);
    const tester = this.pickLaneAgent("Tester", ["Reviewer", "Coordinator"]);
    const builders = this.pickLaneAgents("Builder", ["Coordinator"]);
    const primaryBuilder = builders[0] ?? coordinator;

    if (!coordinator || !scout || !reviewer || !tester || !primaryBuilder) {
      return;
    }

    this.emitBatch([
      this.swarmStarted("coordinating", "Coordinator accepted the operator prompt and opened the swarm lanes."),
      this.timelineEvent("global", {
        id: `timeline:${this.nextId("bootstrap")}`,
        timestamp: this.now(),
        title: "Coordinator boot sequence",
        detail: "Coordinator is decomposing the prompt and assigning the first reconnaissance step.",
        tone: "info"
      }),
      this.messageLogged({
        id: `${this.currentWorkspace!.id}:message:coordinator:${this.nextId("message")}`,
        swarmId: this.swarmId(),
        agentId: coordinator.agent.id,
        direction: "agent",
        authorLabel: coordinator.agent.name,
        recipientLabel: scout.agent.name,
        body: "Begin with repo reconnaissance, then hand builders the most relevant files.",
        createdAt: this.now()
      }),
      this.terminalLine(coordinator.agent.id, {
        id: `${coordinator.agent.id}:terminal:plan:${this.nextId("terminal")}`,
        kind: "stdout",
        text: "> Coordinator published the initial decomposition and opened the scout lane."
      })
    ]);

    this.schedule(180, () => {
      if (!this.canAdvance(scout.agent.id)) {
        return;
      }

      this.setAgentStatus(scout.agent.id, "running");
      this.emitBatch([
        this.stageChanged("scouting"),
        this.planStepUpdated(
          "plan:1",
          "in-progress",
          `${scout.agent.name} is mapping key entrypoints before builders start editing.`
        ),
        this.agentStatusChanged(scout.agent.id, "running", "Scout lane is gathering repository context."),
        this.taskUpdated(
          scout.agent.id,
          scout.tasks[0]!.id,
          "running",
          "Scout is scanning the repository structure and detecting the likely change surface."
        ),
        this.terminalLine(scout.agent.id, {
          id: `${scout.agent.id}:terminal:scan:${this.nextId("terminal")}`,
          kind: "command",
          text: `$ scout.inspect --repo "${this.currentWorkspace!.repository.path}" --focus entrypoints`
        }),
        this.timelineEvent("global", {
          id: `timeline:${this.nextId("scout")}`,
          timestamp: this.now(),
          title: "Scout inspection running",
          detail: `${scout.agent.name} is validating repository structure before builder work starts.`,
          tone: "info"
        })
      ]);
    });

    this.schedule(520, () => {
      if (!this.canAdvance(scout.agent.id)) {
        return;
      }

      this.setAgentStatus(scout.agent.id, "completed");
      this.emitBatch([
        this.taskUpdated(
          scout.agent.id,
          scout.tasks[0]!.id,
          "done",
          "Scout confirmed the primary entrypoints and repo shape."
        ),
        this.taskUpdated(
          scout.agent.id,
          scout.tasks[1]!.id,
          "done",
          "Scout briefed builders on the active files and stack cues."
        ),
        this.agentStatusChanged(scout.agent.id, "completed", "Scout handoff is ready for builder lanes."),
        this.planStepUpdated("plan:1", "done", "Repository context is stable and lane assignments are clear."),
        this.messageLogged({
          id: `${this.currentWorkspace!.id}:message:scout:${this.nextId("message")}`,
          swarmId: this.swarmId(),
          agentId: scout.agent.id,
          direction: "agent",
          authorLabel: scout.agent.name,
          recipientLabel: primaryBuilder.agent.name,
          body: "Repo map is ready. Prioritize the workspace and orchestration state surfaces first.",
          createdAt: this.now()
        }),
        this.timelineEvent("global", {
          id: `timeline:${this.nextId("handoff")}`,
          timestamp: this.now(),
          title: "Scout handoff published",
          detail: `${scout.agent.name} briefed ${primaryBuilder.agent.name} and marked reconnaissance complete.`,
          tone: "success"
        })
      ]);
    });

    this.schedule(860, () => {
      this.emitBatch([
        this.stageChanged("building"),
        this.planStepUpdated(
          "plan:2",
          "in-progress",
          `Builder lanes are executing against the scoped file clusters identified by ${scout.agent.name}.`
        ),
        this.timelineEvent("global", {
          id: `timeline:${this.nextId("builders")}`,
          timestamp: this.now(),
          title: "Builder lanes active",
          detail: `${builders.length} builder lane(s) are now publishing diffs and terminal traces.`,
          tone: "info"
        })
      ]);

      for (const builder of builders) {
        if (!this.canAdvance(builder.agent.id)) {
          continue;
        }

        this.setAgentStatus(builder.agent.id, "running");
        this.emitBatch([
          this.agentStatusChanged(builder.agent.id, "running", "Builder lane is implementing its scoped subtask."),
          this.taskUpdated(
            builder.agent.id,
            builder.tasks[0]!.id,
            "running",
            "Builder is implementing the scoped change set surfaced by the coordinator."
          ),
          this.terminalLine(builder.agent.id, {
            id: `${builder.agent.id}:terminal:build:${this.nextId("terminal")}`,
            kind: "stdout",
            text: `> ${builder.agent.name} is editing ${builder.touchedFiles.map((file) => file.path).join(", ")}`
          }),
          this.diffUpdated(builder.agent.id, {
            summary: `${builder.agent.name} is preparing a focused implementation diff for review.`,
            additions: 24,
            deletions: 3
          })
        ]);
      }
    });

    this.schedule(1420, () => {
      for (const builder of builders) {
        if (!this.canAdvance(builder.agent.id)) {
          continue;
        }

        this.setAgentStatus(builder.agent.id, "waiting");
        this.emitBatch([
          this.taskUpdated(
            builder.agent.id,
            builder.tasks[0]!.id,
            "done",
            "Builder finished the scoped implementation pass."
          ),
          this.taskUpdated(
            builder.agent.id,
            builder.tasks[1]!.id,
            "done",
            "Builder published a diff summary and handed off to review."
          ),
          this.agentStatusChanged(builder.agent.id, "waiting", "Builder is waiting on reviewer and tester feedback."),
          this.diffUpdated(builder.agent.id, {
            summary: `${builder.agent.name} diff is ready for reviewer inspection.`,
            filesChanged: builder.touchedFiles.length,
            additions: 31,
            deletions: 6
          })
        ]);
      }

      if (this.canAdvance(reviewer.agent.id)) {
        this.setAgentStatus(reviewer.agent.id, "running");
        this.emitBatch([
          this.stageChanged("reviewing"),
          this.planStepUpdated(
            "plan:3",
            "in-progress",
            `${reviewer.agent.name} is auditing builder diffs before the tester lane clears the gate.`
          ),
          this.agentStatusChanged(reviewer.agent.id, "running", "Reviewer lane opened the diff gate."),
          this.taskUpdated(
            reviewer.agent.id,
            reviewer.tasks[0]!.id,
            "running",
            "Reviewer is validating diff scope and regression risk."
          ),
          this.messageLogged({
            id: `${this.currentWorkspace!.id}:message:reviewer:${this.nextId("message")}`,
            swarmId: this.swarmId(),
            agentId: reviewer.agent.id,
            direction: "agent",
            authorLabel: reviewer.agent.name,
            recipientLabel: tester.agent.name,
            body: "Diff surface is coherent. Clear the gate only if checks agree with the current state.",
            createdAt: this.now()
          }),
          this.timelineEvent("global", {
            id: `timeline:${this.nextId("review")}`,
            timestamp: this.now(),
            title: "Review gate opened",
            detail: `${reviewer.agent.name} is auditing builder diffs and coordinating with the tester lane.`,
            tone: "warning"
          })
        ]);
      }
    });

    this.schedule(1840, () => {
      if (!this.canAdvance(tester.agent.id)) {
        return;
      }

      this.setAgentStatus(tester.agent.id, "running");
      this.emitBatch([
        this.stageChanged("testing"),
        this.agentStatusChanged(tester.agent.id, "running", "Tester lane is running the configured gates."),
        this.taskUpdated(
          tester.agent.id,
          tester.tasks[0]!.id,
          "running",
          "Tester is progressing lint, typecheck, and build checks."
        ),
        this.checkUpdated(
          tester.agent.id,
          tester.checks[0]!.id,
          "running",
          "Lint is running in mock orchestration mode."
        ),
        this.terminalLine(tester.agent.id, {
          id: `${tester.agent.id}:terminal:test:${this.nextId("terminal")}`,
          kind: "command",
          text: `$ tester.run --checks lint,typecheck,build --mock`
        }),
        this.timelineEvent("global", {
          id: `timeline:${this.nextId("testing")}`,
          timestamp: this.now(),
          title: "Tester lane active",
          detail: `${tester.agent.name} is publishing gate state back to the coordinator and reviewer lanes.`,
          tone: "info"
        })
      ]);
    });

    this.schedule(2360, () => {
      if (!this.canAdvance(tester.agent.id)) {
        return;
      }

      this.setAgentStatus(reviewer.agent.id, "completed");
      this.setAgentStatus(tester.agent.id, "completed");

      this.emitBatch([
        this.checkUpdated(tester.agent.id, tester.checks[0]!.id, "passed", "Lint passed in mock mode."),
        this.checkUpdated(tester.agent.id, tester.checks[1]!.id, "passed", "Typecheck passed in mock mode."),
        this.checkUpdated(tester.agent.id, tester.checks[2]!.id, "passed", "Build passed in mock mode."),
        this.taskUpdated(
          reviewer.agent.id,
          reviewer.tasks[0]!.id,
          "done",
          "Reviewer found no blocking issues in the current mock diff set."
        ),
        this.taskUpdated(
          reviewer.agent.id,
          reviewer.tasks[1]!.id,
          "done",
          "Review gate can advance once the operator performs approval review."
        ),
        this.taskUpdated(
          tester.agent.id,
          tester.tasks[0]!.id,
          "done",
          "Tester completed lint, typecheck, and build gates."
        ),
        this.taskUpdated(
          tester.agent.id,
          tester.tasks[1]!.id,
          "done",
          "Tester published the gate summary back to the coordinator lane."
        ),
        this.agentStatusChanged(reviewer.agent.id, "completed", "Reviewer cleared the mock review gate."),
        this.agentStatusChanged(tester.agent.id, "completed", "Tester published a passing gate summary."),
        this.stageChanged("awaiting-approval"),
        this.swarmStatusChanged("review", "Reviewer and tester lanes cleared the workspace for approval review."),
        this.planStepUpdated("plan:3", "done", "Review and test gates are coherent. Awaiting explicit operator approval."),
        this.messageLogged({
          id: `${this.currentWorkspace!.id}:message:coordinator-ready:${this.nextId("message")}`,
          swarmId: this.swarmId(),
          agentId: coordinator.agent.id,
          direction: "agent",
          authorLabel: coordinator.agent.name,
          recipientLabel: "Operator",
          body: "Diffs and checks are aligned. The merge gate is ready for your review, and roll call is available on demand.",
          createdAt: this.now()
        }),
        this.timelineEvent("global", {
          id: `timeline:${this.nextId("ready")}`,
          timestamp: this.now(),
          title: "Approval review ready",
          detail: "Reviewer and tester lanes cleared the mock gate. Main still stays protected until explicit approval.",
          tone: "success"
        })
      ]);
    });
  }

  private runRollCall(initiatedBy: "Coordinator" | "User") {
    const workspace = this.currentWorkspace;

    if (!workspace) {
      return;
    }

    const rollCallId = `${workspace.id}:rollcall:${this.nextId("rollcall")}`;
    const requestedAt = this.now();
    const inProgress: SwarmRollCallRecord = {
      id: rollCallId,
      requestedAt,
      completedAt: null,
      initiatedBy,
      status: "running",
      summary: "Coordinator is polling every visible lane.",
      agentStatuses: this.snapshotRollCallStatuses()
    };

    this.emitBatch([
      this.rollCallStarted(inProgress),
      this.timelineEvent("global", {
        id: `timeline:${this.nextId("rollcall")}`,
        timestamp: requestedAt,
        title: "Roll call requested",
        detail: `${initiatedBy === "User" ? "Operator" : "Coordinator"} requested a swarm-wide status verification pass.`,
        tone: "info"
      })
    ]);

    this.schedule(260, () => {
      const statuses = this.snapshotRollCallStatuses();
      const completed: SwarmRollCallRecord = {
        ...inProgress,
        completedAt: this.now(),
        status: "completed",
        summary: `Roll call complete: ${createRollCallSummary(statuses)}.`,
        agentStatuses: statuses
      };

      this.emitBatch([
        this.rollCallCompleted(completed),
        this.messageLogged({
          id: `${workspace.id}:message:rollcall:${this.nextId("message")}`,
          swarmId: this.swarmId(),
          direction: "agent",
          agentId: this.pickLaneAgent("Coordinator")?.agent.id,
          authorLabel: this.pickLaneAgent("Coordinator")?.agent.name ?? "Coordinator",
          recipientLabel: "Operator",
          body: completed.summary,
          createdAt: this.now()
        }),
        this.timelineEvent("global", {
          id: `timeline:${this.nextId("rollcall-complete")}`,
          timestamp: this.now(),
          title: "Roll call complete",
          detail: completed.summary,
          tone: "success"
        })
      ]);
    });
  }

  private snapshotRollCallStatuses(): RollCallAgentStatusRecord[] {
    const workspace = this.currentWorkspace;

    if (!workspace) {
      return [];
    }

    return workspace.agents.map((entry) => ({
      agentId: entry.agent.id,
      agentName: entry.agent.name,
      status: this.currentStatuses.get(entry.agent.id) ?? entry.agent.status,
      note: this.describeStatus(entry.agent.role, this.currentStatuses.get(entry.agent.id) ?? entry.agent.status)
    }));
  }

  private buildAgentReply(agent: WorkspaceAgentSession): string {
    const byRole: Record<AgentRole, string> = {
      Coordinator: "I recorded the note and will keep the other lanes synchronized around it.",
      Builder: "I have the instruction and will keep the diff scoped for review.",
      Scout: "I will fold that into the repo map and update the handoff if it changes priority.",
      Reviewer: "I will hold the review gate to that standard and call out any drift explicitly.",
      Tester: "I will reflect that in the gate summary and keep the validation lane visible."
    };

    return byRole[agent.agent.role];
  }

  private describeStatus(role: AgentRole, status: AgentStatus): string {
    if (status === "paused") {
      return `${role} lane is paused by the operator.`;
    }

    if (status === "stopped") {
      return `${role} lane is stopped and awaiting a new run.`;
    }

    if (status === "completed") {
      return `${role} lane has completed its current handoff.`;
    }

    if (status === "running" || status === "planning") {
      return `${role} lane is actively progressing its current responsibility.`;
    }

    return `${role} lane is visible and waiting on the next coordination step.`;
  }

  private canAdvance(agentId: string): boolean {
    const status = this.currentStatuses.get(agentId);
    return status !== "paused" && status !== "stopped";
  }

  private setAgentStatus(agentId: string, status: AgentStatus) {
    const current = this.currentStatuses.get(agentId);

    if (current && current !== "paused" && current !== "stopped") {
      this.previousStatuses.set(agentId, current);
    }

    this.currentStatuses.set(agentId, status);
  }

  private pickLaneAgents(role: AgentRole, fallbackRoles: AgentRole[] = []): WorkspaceAgentSession[] {
    const workspace = this.currentWorkspace;

    if (!workspace) {
      return [];
    }

    const direct = workspace.agents.filter((entry) => entry.agent.role === role);
    if (direct.length > 0) {
      return direct;
    }

    for (const fallbackRole of fallbackRoles) {
      const fallback = workspace.agents.filter((entry) => entry.agent.role === fallbackRole);
      if (fallback.length > 0) {
        return fallback;
      }
    }

    return workspace.agents.slice(0, 1);
  }

  private pickLaneAgent(role: AgentRole, fallbackRoles: AgentRole[] = []): WorkspaceAgentSession | undefined {
    return this.pickLaneAgents(role, fallbackRoles)[0];
  }

  private findAgentById(agentId: string): WorkspaceAgentSession | undefined {
    return this.currentWorkspace?.agents.find((entry) => entry.agent.id === agentId);
  }

  private emitBatch(events: OrchestrationEvent[]) {
    for (const event of events) {
      this.emit(event);
    }
  }

  private emit(event: OrchestrationEvent) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private clearTimers() {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }

    this.timers.clear();
  }

  private schedule(delayMs: number, callback: () => void) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delayMs);

    this.timers.add(timer);
  }

  private now(): string {
    return new Date().toISOString();
  }

  private nextId(prefix: string): string {
    this.eventSequence += 1;
    return `${prefix}-${this.eventSequence}`;
  }

  private swarmId(): string {
    return this.currentWorkspace?.agents[0]?.agent.swarmId ?? this.currentWorkspace?.id ?? "swarm:unknown";
  }

  private baseEvent(kind: OrchestrationEvent["kind"], timestamp = this.now()) {
    return {
      id: `${this.currentWorkspace?.id ?? "workspace"}:${this.nextId("event")}`,
      workspaceId: this.currentWorkspace?.id ?? "workspace:unknown",
      timestamp,
      kind
    } as const;
  }

  private swarmStarted(stage: WorkspaceSession["orchestrationStage"], summary: string): OrchestrationEvent {
    return {
      ...this.baseEvent("swarm.started"),
      kind: "swarm.started",
      payload: { stage, summary }
    };
  }

  private swarmStatusChanged(status: WorkspaceSession["status"], summary: string): OrchestrationEvent {
    return {
      ...this.baseEvent("swarm.status.changed"),
      kind: "swarm.status.changed",
      payload: { status, summary }
    };
  }

  private stageChanged(stage: WorkspaceSession["orchestrationStage"]): OrchestrationEvent {
    return {
      ...this.baseEvent("stage.changed"),
      kind: "stage.changed",
      payload: { stage }
    };
  }

  private planStepUpdated(
    planItemId: string,
    status: WorkspaceSession["coordinatorPlan"][number]["status"],
    note: string
  ): OrchestrationEvent {
    return {
      ...this.baseEvent("plan.step.updated"),
      kind: "plan.step.updated",
      payload: { planItemId, status, note }
    };
  }

  private agentStatusChanged(agentId: string, status: AgentStatus, reason: string): OrchestrationEvent {
    return {
      ...this.baseEvent("agent.status.changed"),
      kind: "agent.status.changed",
      agentId,
      payload: { status, reason }
    };
  }

  private taskUpdated(
    agentId: string,
    taskId: string,
    status: WorkspaceSession["agents"][number]["tasks"][number]["status"],
    summary: string
  ): OrchestrationEvent {
    return {
      ...this.baseEvent("task.updated"),
      kind: "task.updated",
      agentId,
      payload: { taskId, status, summary }
    };
  }

  private terminalLine(agentId: string, line: TerminalLineRecord): OrchestrationEvent {
    return {
      ...this.baseEvent("terminal.line.added"),
      kind: "terminal.line.added",
      agentId,
      payload: { line }
    };
  }

  private timelineEvent(scope: "global" | "agent", event: TimelineEventRecord): OrchestrationEvent {
    return {
      ...this.baseEvent("timeline.event", event.timestamp),
      kind: "timeline.event",
      payload: { scope, event }
    };
  }

  private messageLogged(message: MessageRecord): OrchestrationEvent {
    return {
      ...this.baseEvent("message.logged", message.createdAt),
      kind: "message.logged",
      payload: { message }
    };
  }

  private checkUpdated(
    agentId: string,
    checkId: string,
    status: WorkspaceSession["agents"][number]["checks"][number]["status"],
    summary: string
  ): OrchestrationEvent {
    return {
      ...this.baseEvent("check.updated"),
      kind: "check.updated",
      agentId,
      payload: { checkId, status, summary }
    };
  }

  private diffUpdated(
    agentId: string,
    payload: Partial<WorkspaceSession["agents"][number]["diffSummary"]>
  ): OrchestrationEvent {
    return {
      ...this.baseEvent("diff.updated"),
      kind: "diff.updated",
      agentId,
      payload
    };
  }

  private rollCallStarted(rollCall: SwarmRollCallRecord): OrchestrationEvent {
    return {
      ...this.baseEvent("rollcall.started", rollCall.requestedAt),
      kind: "rollcall.started",
      payload: { rollCall }
    };
  }

  private rollCallCompleted(rollCall: SwarmRollCallRecord): OrchestrationEvent {
    return {
      ...this.baseEvent("rollcall.completed", rollCall.completedAt ?? rollCall.requestedAt),
      kind: "rollcall.completed",
      payload: { rollCall }
    };
  }
}
