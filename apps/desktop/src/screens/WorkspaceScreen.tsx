import { useState } from "react";
import {
  deriveMergeQueueEntries,
  findMergeQueueEntry,
  getWorkspaceAgentSession,
  getWorkspaceTouchedFiles,
  type CheckStatus,
  type MessageRecord,
  type WorkspaceSession
} from "@forgeswarm/shared";
import { Panel, StatusBadge } from "@forgeswarm/ui";

function statusTone(status: string) {
  if (
    status === "running" ||
    status === "planning" ||
    status === "info" ||
    status === "coordinating" ||
    status === "scouting" ||
    status === "building" ||
    status === "reviewing" ||
    status === "testing"
  ) {
    return "info";
  }

  if (
    status === "completed" ||
    status === "done" ||
    status === "passed" ||
    status === "success" ||
    status === "review" ||
    status === "awaiting-approval" ||
    status === "approved"
  ) {
    return "success";
  }

  if (
    status === "blocked" ||
    status === "awaiting-checks" ||
    status === "awaiting-decision" ||
    status === "warning" ||
    status === "failed" ||
    status === "paused" ||
    status === "stopped" ||
    status === "dirty" ||
    status === "conflicted" ||
    status === "error" ||
    status === "rejected" ||
    status === "changes-requested"
  ) {
    return "warning";
  }

  return "neutral";
}

function checkTone(status: CheckStatus) {
  return status === "passed" ? "success" : status === "failed" || status === "running" ? "warning" : "neutral";
}

function controlButtonClass(tone: "default" | "warning" = "default") {
  return tone === "warning"
    ? "border-amber-600/40 bg-amber-600/10 text-amber-300 hover:border-amber-500/60"
    : "border-[#454545] bg-[#3a3d41] text-[#cccccc] hover:border-[#555555] hover:bg-[#45494e]";
}

function formatMessageLabel(message: MessageRecord) {
  return message.recipientLabel ? `${message.authorLabel} → ${message.recipientLabel}` : message.authorLabel;
}

export function WorkspaceScreen({
  onApproveMerge,
  onOpenMergeQueue,
  health,
  healthError,
  onPauseAgent,
  onRejectMerge,
  onRequestChanges,
  onResumeAgent,
  onRunRollCall,
  onSelectAgent,
  onSendMessage,
  onStopAgent,
  workspaceSession
}: {
  onApproveMerge: (agentId: string) => void;
  onOpenMergeQueue: (agentId?: string) => void;
  health: { app: string; status: string; rust: string } | null;
  healthError: string | null;
  onPauseAgent: (agentId: string) => void;
  onRejectMerge: (agentId: string) => void;
  onRequestChanges: (agentId: string) => void;
  onResumeAgent: (agentId: string) => void;
  onRunRollCall: () => void;
  onSelectAgent: (agentId: string) => void;
  onSendMessage: (agentId: string, body: string) => void;
  onStopAgent: (agentId: string) => void;
  workspaceSession: WorkspaceSession | null;
}) {
  const [messageDraft, setMessageDraft] = useState("");

  if (!workspaceSession) {
    return (
      <Panel eyebrow="Workspace" title="Swarm Required">
        <p className="text-sm text-[#cccccc]">
          Start a swarm from the setup screen to hydrate the workspace shell with active agents, timeline data, and
          review context.
        </p>
      </Panel>
    );
  }

  const activeAgent = getWorkspaceAgentSession(workspaceSession, workspaceSession.activeAgentId);
  const activeTouchedFiles = getWorkspaceTouchedFiles(workspaceSession, workspaceSession.activeAgentId);
  const taskCounts = workspaceSession.agents.flatMap((entry) => entry.tasks).reduce(
    (accumulator, task) => {
      accumulator[task.status] += 1;
      return accumulator;
    },
    { todo: 0, running: 0, blocked: 0, done: 0 }
  );
  const relevantMessages = workspaceSession.messages
    .filter(
      (message) =>
        !message.agentId ||
        message.agentId === activeAgent.agent.id ||
        message.recipientLabel === activeAgent.agent.name ||
        message.recipientLabel === "Operator"
    )
    .slice(-6);
  const isPaused = activeAgent.agent.status === "paused";
  const isStopped = activeAgent.agent.status === "stopped";
  const gitIsolation = workspaceSession.gitIsolation;
  const mergeEntries = deriveMergeQueueEntries(workspaceSession);
  const activeQueueEntry = findMergeQueueEntry(workspaceSession, activeAgent.agent.id) ?? mergeEntries[0] ?? null;
  const gateChecks = activeQueueEntry?.checks ?? activeAgent.checks;

  return (
    <div className="grid gap-3 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
      <div className="space-y-3">
        <Panel
          eyebrow="Swarm Navigation"
          title="Agents"
          actions={<StatusBadge label={workspaceSession.orchestrationStage} tone={statusTone(workspaceSession.orchestrationStage)} />}
        >
          <div className="space-y-1.5">
            {workspaceSession.agents.map((entry) => (
              <button
                key={entry.agent.id}
                className={`w-full rounded border px-3 py-2.5 text-left transition ${
                  entry.agent.id === workspaceSession.activeAgentId
                    ? "border-[#007acc]/50 bg-[#007acc]/8"
                    : "border-[#3c3c3c] bg-[#2d2d30] hover:border-[#454545]"
                }`}
                onClick={() => onSelectAgent(entry.agent.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[#cccccc]">{entry.agent.name}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-[#858585]">{entry.agent.branchName}</div>
                  </div>
                  <StatusBadge label={entry.agent.status} tone={statusTone(entry.agent.status)} />
                </div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel eyebrow="Lifecycle Controls" title={activeAgent.agent.name}>
          <div className="grid grid-cols-2 gap-2">
            <button
              className={`rounded border px-2.5 py-1.5 text-sm transition ${controlButtonClass()}`}
              disabled={isPaused || isStopped}
              onClick={() => onPauseAgent(activeAgent.agent.id)}
              type="button"
            >
              Pause
            </button>
            <button
              className={`rounded border px-2.5 py-1.5 text-sm transition ${controlButtonClass()}`}
              onClick={() => onResumeAgent(activeAgent.agent.id)}
              type="button"
            >
              Resume
            </button>
            <button
              className={`rounded border px-2.5 py-1.5 text-sm transition ${controlButtonClass("warning")}`}
              disabled={isStopped}
              onClick={() => onStopAgent(activeAgent.agent.id)}
              type="button"
            >
              Stop
            </button>
            <button
              className={`rounded border px-2.5 py-1.5 text-sm transition ${controlButtonClass()}`}
              onClick={onRunRollCall}
              type="button"
            >
              Roll Call
            </button>
          </div>
        </Panel>

        <Panel eyebrow="Task Status" title="Swarm Snapshot">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-2.5 py-2 text-[#858585]">
              Running <span className="font-semibold text-[#cccccc]">{taskCounts.running}</span>
            </div>
            <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-2.5 py-2 text-[#858585]">
              Todo <span className="font-semibold text-[#cccccc]">{taskCounts.todo}</span>
            </div>
            <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-2.5 py-2 text-[#858585]">
              Blocked <span className="font-semibold text-[#cccccc]">{taskCounts.blocked}</span>
            </div>
            <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-2.5 py-2 text-[#858585]">
              Done <span className="font-semibold text-[#cccccc]">{taskCounts.done}</span>
            </div>
          </div>
          <div className="mt-2 rounded border border-[#3c3c3c] bg-[#2d2d30] px-2.5 py-2 text-sm text-[#858585]">
            Status: <span className="font-semibold text-[#cccccc]">{workspaceSession.status}</span>
          </div>
          {workspaceSession.lastRollCall ? (
            <div className="mt-2 rounded border border-[#3c3c3c] bg-[#2d2d30] px-2.5 py-2 text-sm text-[#858585]">
              Last roll call:
              <div className="mt-0.5 font-semibold text-[#cccccc]">{workspaceSession.lastRollCall.summary}</div>
            </div>
          ) : null}
        </Panel>

        <Panel eyebrow="Touched Files" title={`${activeAgent.agent.name} Focus`}>
          <div className="space-y-1.5 font-mono text-[11px] text-[#cccccc]">
            {activeTouchedFiles.map((file) => (
              <div
                key={`${file.agentId}:${file.path}`}
                className="flex items-center justify-between rounded border border-[#3c3c3c] bg-[#2d2d30] px-2.5 py-1.5"
              >
                <span>{file.path}</span>
                <StatusBadge label={file.changeType} tone="info" />
              </div>
            ))}
          </div>
        </Panel>

        <Panel eyebrow="Git Isolation" title={`${activeAgent.agent.name} Lane`}>
          <div className="space-y-2 text-sm text-[#cccccc]">
            <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-2.5 py-2">
              Strategy: <span className="font-semibold">{activeAgent.git.strategy}</span>
            </div>
            <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-2.5 py-2">
              Branch: <span className="font-semibold font-mono">{activeAgent.git.branchName}</span>
              <div className="mt-0.5 font-mono text-[10px] text-[#858585]">{activeAgent.git.worktreePath}</div>
            </div>
            <div className="flex items-center justify-between rounded border border-[#3c3c3c] bg-[#2d2d30] px-2.5 py-2">
              <div>
                <div className="text-sm text-[#cccccc]">Isolation status</div>
                <div className="mt-0.5 text-[10px] text-[#858585]">{activeAgent.git.note}</div>
              </div>
              <StatusBadge label={activeAgent.git.status} tone={statusTone(activeAgent.git.status)} />
            </div>
            <div className="flex items-center justify-between rounded border border-[#3c3c3c] bg-[#2d2d30] px-2.5 py-2">
              <div>
                <div className="text-sm text-[#cccccc]">Conflict state</div>
                <div className="mt-0.5 text-[10px] text-[#858585]">Reset and rollback remain confirmation-gated.</div>
              </div>
              <StatusBadge label={activeAgent.git.conflictState} tone={statusTone(activeAgent.git.conflictState)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`rounded border px-2.5 py-1.5 text-sm transition ${controlButtonClass()}`}
                disabled={!activeAgent.git.resetAvailable}
                type="button"
              >
                Reset Lane
              </button>
              <button
                className={`rounded border px-2.5 py-1.5 text-sm transition ${controlButtonClass()}`}
                disabled={!activeAgent.git.rollbackAvailable}
                type="button"
              >
                Rollback
              </button>
            </div>
          </div>
        </Panel>
      </div>

      <div className="space-y-3">
        <Panel
          eyebrow="Active Terminal"
          title={activeAgent.terminal.title}
          actions={<StatusBadge label={activeAgent.agent.status} tone={statusTone(activeAgent.agent.status)} />}
        >
          <div className="rounded border border-[#3c3c3c] bg-[#1a1a1a] p-3">
            <div className="mb-2 border-b border-[#3c3c3c] pb-2 font-mono text-[10px] uppercase tracking-wider text-[#858585]">
              {activeAgent.terminal.cwd}
            </div>
            <div className="space-y-1 font-mono text-[12px] leading-5 text-[#cccccc]">
              {activeAgent.terminal.lines.map((line) => (
                <div
                  key={line.id}
                  className={
                    line.kind === "stderr"
                      ? "text-amber-300"
                      : line.kind === "command"
                        ? "text-[#9cdcfe]"
                        : line.kind === "system"
                          ? "text-[#858585]"
                          : ""
                  }
                >
                  {line.text}
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel eyebrow="Timeline" title="Structured Events">
          <div className="space-y-2">
            {workspaceSession.globalTimeline.concat(activeAgent.timeline).map((entry) => (
              <div
                key={entry.id}
                className="flex gap-3 rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2.5"
              >
                <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-sm bg-[#007acc]" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[10px] uppercase tracking-wider text-[#858585]">{entry.title}</div>
                    <StatusBadge label={entry.tone} tone={statusTone(entry.tone)} />
                  </div>
                  <p className="mt-1 text-sm text-[#cccccc]">{entry.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel eyebrow="Coordinator Plan" title="Milestone Breakdown">
          <div className="space-y-2">
            {workspaceSession.coordinatorPlan.map((item) => (
              <div
                key={item.id}
                className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-[#cccccc]">{item.title}</div>
                  <StatusBadge label={item.status} tone={statusTone(item.status)} />
                </div>
                <div className="mt-1 text-[10px] text-[#858585]">{item.ownerRole}</div>
                <p className="mt-1 text-sm text-[#cccccc]">{item.note}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="space-y-3">
        <Panel eyebrow="Coordination Feed" title="Side Chat">
          <div className="space-y-2">
            {relevantMessages.map((message) => (
              <div key={message.id} className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-[#cccccc]">{formatMessageLabel(message)}</div>
                  <div className="text-[10px] text-[#858585]">{new Date(message.createdAt).toLocaleTimeString()}</div>
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-[#858585]">{message.direction}</div>
                <p className="mt-1.5 text-sm text-[#cccccc]">{message.body}</p>
              </div>
            ))}

            <form
              className="space-y-2 rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-3"
              onSubmit={(event) => {
                event.preventDefault();

                const nextMessage = messageDraft.trim();
                if (!nextMessage) {
                  return;
                }

                onSendMessage(activeAgent.agent.id, nextMessage);
                setMessageDraft("");
              }}
            >
              <div className="text-[10px] uppercase tracking-wider text-[#858585]">
                Message {activeAgent.agent.name}
              </div>
              <textarea
                className="min-h-20 w-full rounded border border-[#3c3c3c] bg-[#1e1e1e] px-2.5 py-2 text-sm text-[#cccccc] outline-none transition focus:border-[#007acc]/60"
                onChange={(event) => setMessageDraft(event.target.value)}
                placeholder={`Send ${activeAgent.agent.name} a direct instruction`}
                value={messageDraft}
              />
              <button
                className={`w-full rounded border px-2.5 py-1.5 text-sm transition ${controlButtonClass()}`}
                type="submit"
              >
                Send Message
              </button>
            </form>
          </div>
        </Panel>

        <Panel eyebrow="Diff Review" title={activeAgent.diffSummary.title}>
          <div className="space-y-2.5">
            <p className="text-sm text-[#cccccc]">{activeAgent.diffSummary.summary}</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-2.5 py-2 text-sm text-[#858585]">
                Files
                <div className="mt-0.5 font-semibold text-[#cccccc]">{activeAgent.diffSummary.filesChanged}</div>
              </div>
              <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-2.5 py-2 text-sm text-[#858585]">
                Additions
                <div className="mt-0.5 font-semibold text-emerald-300">+{activeAgent.diffSummary.additions}</div>
              </div>
              <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-2.5 py-2 text-sm text-[#858585]">
                Deletions
                <div className="mt-0.5 font-semibold text-amber-300">-{activeAgent.diffSummary.deletions}</div>
              </div>
            </div>
            <div className="space-y-1.5">
              {activeAgent.diffSections.map((section) => (
                <div key={section.id} className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-[#cccccc]">{section.title}</div>
                    <StatusBadge label={section.risk} tone={section.risk === "low" ? "success" : "warning"} />
                  </div>
                  <p className="mt-1 text-sm text-[#cccccc]">{section.summary}</p>
                  <div className="mt-2 space-y-1 font-mono text-[10px] text-[#858585]">
                    {section.files.map((file) => (
                      <div
                        key={`${section.id}:${file}`}
                        className="rounded border border-[#3c3c3c] bg-[#1e1e1e] px-2 py-1"
                      >
                        {file}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              {activeAgent.diffFiles.map((file) => (
                <div
                  key={`${activeAgent.agent.id}:${file.path}`}
                  className="flex items-start justify-between gap-3 rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2.5"
                >
                  <div>
                    <div className="font-mono text-sm text-[#cccccc]">{file.path}</div>
                    <div className="mt-0.5 text-[10px] text-[#858585]">{file.note}</div>
                  </div>
                  <div className="text-right font-mono text-[11px]">
                    <div className="text-emerald-300">+{file.additions}</div>
                    <div className="text-amber-300">-{file.deletions}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel eyebrow="Checks" title="Gate Status">
          <div className="space-y-1.5">
            {gateChecks.map((check) => (
              <div
                key={check.id}
                className="flex items-center justify-between rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2"
              >
                <div>
                  <div className="text-sm text-[#cccccc]">{check.name}</div>
                  <div className="mt-0.5 text-[10px] text-[#858585]">{check.summary}</div>
                </div>
                <StatusBadge label={check.status} tone={checkTone(check.status)} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel eyebrow="Approvals" title="Review Controls">
          <div className="space-y-2">
            <div className="rounded border border-amber-600/30 bg-amber-600/8 px-3 py-2.5 text-sm text-amber-300">
              Merge approval remains manual. Main stays protected until a user explicitly approves.
            </div>
            {activeQueueEntry ? (
              <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-[#cccccc]">Merge Readiness</div>
                  <StatusBadge label={activeQueueEntry.mergeReadiness} tone={statusTone(activeQueueEntry.mergeReadiness)} />
                </div>
                <p className="mt-1 text-sm text-[#cccccc]">{activeQueueEntry.readinessSummary}</p>
                {activeQueueEntry.blockedReasons.length > 0 ? (
                  <div className="mt-2 space-y-1.5">
                    {activeQueueEntry.blockedReasons.map((reason) => (
                      <div
                        key={`${activeQueueEntry.agentId}:${reason}`}
                        className="rounded border border-amber-600/30 bg-amber-600/8 px-2.5 py-1.5 text-sm text-amber-300"
                      >
                        {reason}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-[#cccccc]">Operator Decision</div>
                <StatusBadge label={activeAgent.approval.status} tone={statusTone(activeAgent.approval.status)} />
              </div>
              <p className="mt-1 text-sm text-[#cccccc]">{activeAgent.approval.summary}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  className={`rounded border px-2.5 py-1.5 text-sm transition ${controlButtonClass()}`}
                  onClick={() => onApproveMerge(activeAgent.agent.id)}
                  type="button"
                >
                  Approve
                </button>
                <button
                  className={`rounded border px-2.5 py-1.5 text-sm transition ${controlButtonClass("warning")}`}
                  onClick={() => onRequestChanges(activeAgent.agent.id)}
                  type="button"
                >
                  Request Changes
                </button>
                <button
                  className={`rounded border px-2.5 py-1.5 text-sm transition ${controlButtonClass("warning")}`}
                  onClick={() => onRejectMerge(activeAgent.agent.id)}
                  type="button"
                >
                  Reject
                </button>
                <button
                  className={`rounded border px-2.5 py-1.5 text-sm transition ${controlButtonClass()}`}
                  onClick={() => onOpenMergeQueue(activeAgent.agent.id)}
                  type="button"
                >
                  Open Queue
                </button>
              </div>
            </div>
            {gitIsolation ? (
              <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-[#cccccc]">Protected Branch</div>
                  <StatusBadge label={gitIsolation.status} tone={statusTone(gitIsolation.status)} />
                </div>
                <p className="mt-1 text-sm text-[#cccccc]">
                  {gitIsolation.protectedBranch.name} stays protected while {gitIsolation.workspaces.length} isolated lane(s) prepare review.
                </p>
                <div className="mt-2 space-y-1.5">
                  <div className="rounded border border-[#3c3c3c] bg-[#1e1e1e] px-2.5 py-1.5 font-mono text-sm text-[#cccccc]">
                    {gitIsolation.protectedBranch.currentBranch ?? "unknown"}
                  </div>
                  {gitIsolation.warnings.map((warning) => (
                    <div
                      key={warning}
                      className="rounded border border-amber-600/30 bg-amber-600/8 px-2.5 py-1.5 text-sm text-amber-300"
                    >
                      {warning}
                    </div>
                  ))}
                  {gitIsolation.errors.map((error) => (
                    <div
                      key={error}
                      className="rounded border border-amber-600/30 bg-amber-600/8 px-2.5 py-1.5 text-sm text-amber-300"
                    >
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {workspaceSession.lastRollCall ? (
              <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-[#cccccc]">Status Verification</div>
                  <StatusBadge
                    label={workspaceSession.lastRollCall.status}
                    tone={statusTone(workspaceSession.lastRollCall.status)}
                  />
                </div>
                <p className="mt-1 text-sm text-[#cccccc]">{workspaceSession.lastRollCall.summary}</p>
                <div className="mt-2 space-y-1.5">
                  {workspaceSession.lastRollCall.agentStatuses.map((status) => (
                    <div
                      key={status.agentId}
                      className="flex items-center justify-between rounded border border-[#3c3c3c] bg-[#1e1e1e] px-2.5 py-1.5"
                    >
                      <div>
                        <div className="text-sm text-[#cccccc]">{status.agentName}</div>
                        <div className="mt-0.5 text-[10px] text-[#858585]">{status.note}</div>
                      </div>
                      <StatusBadge label={status.status} tone={statusTone(status.status)} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {activeAgent.comments.map((comment) => (
              <div
                key={comment.id}
                className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-[#cccccc]">{comment.author}</div>
                  <div className="text-[10px] text-[#858585]">{new Date(comment.createdAt).toLocaleTimeString()}</div>
                </div>
                <p className="mt-1 text-sm text-[#cccccc]">{comment.body}</p>
              </div>
            ))}
            {activeAgent.approval.auditTrail.map((audit) => (
              <div
                key={audit.id}
                className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-[#cccccc]">{audit.actor}</div>
                  <div className="text-[10px] text-[#858585]">{new Date(audit.createdAt).toLocaleTimeString()}</div>
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-[#858585]">{audit.action}</div>
                <p className="mt-1 text-sm text-[#cccccc]">{audit.summary}</p>
              </div>
            ))}
            <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2 text-[11px] text-[#858585]">
              {health ? `${health.app} backend ${health.status} on ${health.rust}` : "Waiting for native shell"}
              {healthError ? <div className="mt-1 text-amber-300">{healthError}</div> : null}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
