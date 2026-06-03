import { useEffect, useState } from "react";
import { deriveMergeQueueEntries, type CheckStatus, type MergeQueueEntry, type WorkspaceSession } from "@forgeswarm/shared";
import { Panel, StatusBadge } from "@forgeswarm/ui";

function toneForStatus(status: string) {
  if (status === "approved" || status === "passed" || status === "ready") {
    return "success";
  }

  if (
    status === "running" ||
    status === "awaiting-checks" ||
    status === "awaiting-decision" ||
    status === "warning"
  ) {
    return "warning";
  }

  if (status === "blocked" || status === "rejected" || status === "changes-requested" || status === "error") {
    return "warning";
  }

  return "neutral";
}

function checkTone(status: CheckStatus) {
  return status === "passed" ? "success" : status === "failed" || status === "running" ? "warning" : "neutral";
}

function actionButtonClass(mode: "default" | "warning" | "success" = "default") {
  if (mode === "success") {
    return "border-emerald-600/40 bg-emerald-600/10 text-emerald-300 hover:border-emerald-500/60 hover:bg-emerald-600/15";
  }

  if (mode === "warning") {
    return "border-amber-600/40 bg-amber-600/10 text-amber-300 hover:border-amber-500/60";
  }

  return "border-[#454545] bg-[#3a3d41] text-[#cccccc] hover:border-[#555555] hover:bg-[#45494e]";
}

function QueueLaneDetail({
  entry,
  onApproveMerge,
  onFocusLane,
  onRejectMerge,
  onRequestChanges
}: {
  entry: MergeQueueEntry;
  onApproveMerge: (agentId: string) => void;
  onFocusLane: (agentId: string) => void;
  onRejectMerge: (agentId: string) => void;
  onRequestChanges: (agentId: string) => void;
}) {
  return (
    <>
      <Panel
        eyebrow="Lane Summary"
        title={entry.diffSummary.title}
        actions={<StatusBadge label={entry.mergeReadiness} tone={toneForStatus(entry.mergeReadiness)} />}
      >
        <div className="space-y-2.5">
          <p className="text-sm text-[#cccccc]">{entry.readinessSummary}</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-2.5 py-2 text-sm text-[#858585]">
              Files
              <div className="mt-0.5 font-semibold text-[#cccccc]">{entry.diffSummary.filesChanged}</div>
            </div>
            <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-2.5 py-2 text-sm text-[#858585]">
              Additions
              <div className="mt-0.5 font-semibold text-emerald-300">+{entry.diffSummary.additions}</div>
            </div>
            <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-2.5 py-2 text-sm text-[#858585]">
              Deletions
              <div className="mt-0.5 font-semibold text-amber-300">-{entry.diffSummary.deletions}</div>
            </div>
          </div>
          <div className="space-y-1.5">
            {entry.diffSections.map((section) => (
              <div key={section.id} className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-[#cccccc]">{section.title}</div>
                  <StatusBadge label={section.risk} tone={section.risk === "low" ? "success" : "warning"} />
                </div>
                <p className="mt-1 text-sm text-[#cccccc]">{section.summary}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {section.files.map((file) => (
                    <span
                      key={`${section.id}:${file}`}
                      className="rounded border border-[#3c3c3c] bg-[#1e1e1e] px-1.5 py-0.5 font-mono text-[10px] text-[#858585]"
                    >
                      {file}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel eyebrow="Diff Files" title="Touched Paths">
        <div className="space-y-1.5">
          {entry.diffFiles.map((file) => (
            <div
              key={`${entry.agentId}:${file.path}`}
              className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-sm text-[#cccccc]">{file.path}</div>
                <StatusBadge label={file.changeType} tone="info" />
              </div>
              <div className="mt-1.5 flex items-center gap-3 font-mono text-[11px]">
                <span className="text-emerald-300">+{file.additions}</span>
                <span className="text-amber-300">-{file.deletions}</span>
              </div>
              <p className="mt-1 text-sm text-[#858585]">{file.note}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel eyebrow="Decision Surface" title="Approval Controls">
        <div className="space-y-2">
          <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-[#cccccc]">Approval State</div>
              <StatusBadge label={entry.approval.status} tone={toneForStatus(entry.approval.status)} />
            </div>
            <p className="mt-1 text-sm text-[#cccccc]">{entry.approval.summary}</p>
          </div>

          {entry.blockedReasons.length > 0 ? (
            <div className="space-y-1.5">
              {entry.blockedReasons.map((reason) => (
                <div
                  key={`${entry.agentId}:${reason}`}
                  className="rounded border border-amber-600/30 bg-amber-600/8 px-3 py-2 text-sm text-amber-300"
                >
                  {reason}
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              className={`rounded border px-2.5 py-1.5 text-sm transition ${actionButtonClass("success")}`}
              onClick={() => onApproveMerge(entry.agentId)}
              type="button"
            >
              Approve
            </button>
            <button
              className={`rounded border px-2.5 py-1.5 text-sm transition ${actionButtonClass("warning")}`}
              onClick={() => onRequestChanges(entry.agentId)}
              type="button"
            >
              Request Changes
            </button>
            <button
              className={`rounded border px-2.5 py-1.5 text-sm transition ${actionButtonClass("warning")}`}
              onClick={() => onRejectMerge(entry.agentId)}
              type="button"
            >
              Reject
            </button>
            <button
              className={`rounded border px-2.5 py-1.5 text-sm transition ${actionButtonClass()}`}
              onClick={() => onFocusLane(entry.agentId)}
              type="button"
            >
              Open Workspace
            </button>
          </div>
        </div>
      </Panel>
    </>
  );
}

export function MergeQueueScreen({
  onApproveMerge,
  onFocusLane,
  onRejectMerge,
  onRequestChanges,
  workspaceSession
}: {
  onApproveMerge: (agentId: string) => void;
  onFocusLane: (agentId: string) => void;
  onRejectMerge: (agentId: string) => void;
  onRequestChanges: (agentId: string) => void;
  workspaceSession: WorkspaceSession | null;
}) {
  const entries = workspaceSession ? deriveMergeQueueEntries(workspaceSession) : [];
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(workspaceSession?.activeAgentId ?? null);

  useEffect(() => {
    if (entries.length === 0) {
      setSelectedAgentId(null);
      return;
    }

    if (!selectedAgentId || !entries.some((entry) => entry.agentId === selectedAgentId)) {
      setSelectedAgentId(entries[0]!.agentId);
    }
  }, [entries, selectedAgentId]);

  if (!workspaceSession || entries.length === 0) {
    return (
      <Panel eyebrow="Merge Queue" title="Swarm Required">
        <p className="text-sm text-[#cccccc]">
          Start a swarm to populate isolated lanes, review state, and explicit approval decisions.
        </p>
      </Panel>
    );
  }

  const selectedEntry = entries.find((entry) => entry.agentId === selectedAgentId) ?? entries[0]!;

  return (
    <div className="grid gap-3 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
      <div className="space-y-3">
        <Panel
          eyebrow="Protected Branch"
          title={workspaceSession.gitIsolation?.protectedBranch.name ?? workspaceSession.repository.branch ?? "main"}
          actions={
            workspaceSession.gitIsolation ? (
              <StatusBadge label={workspaceSession.gitIsolation.status} tone={toneForStatus(workspaceSession.gitIsolation.status)} />
            ) : undefined
          }
        >
          <div className="space-y-1.5 text-sm text-[#cccccc]">
            <div>Main remains protected until an operator explicitly approves a lane.</div>
            {workspaceSession.gitIsolation?.warnings.map((warning) => (
              <div
                key={warning}
                className="rounded border border-amber-600/30 bg-amber-600/8 px-2.5 py-2 text-sm text-amber-300"
              >
                {warning}
              </div>
            ))}
            {workspaceSession.gitIsolation?.errors.map((error) => (
              <div
                key={error}
                className="rounded border border-amber-600/30 bg-amber-600/8 px-2.5 py-2 text-sm text-amber-300"
              >
                {error}
              </div>
            ))}
          </div>
        </Panel>

        <Panel eyebrow="Queue" title="Pending Lanes">
          <div className="space-y-1.5">
            {entries.map((entry) => (
              <button
                key={entry.id}
                className={`w-full rounded border px-3 py-2.5 text-left transition ${
                  entry.agentId === selectedEntry.agentId
                    ? "border-[#007acc]/50 bg-[#007acc]/8"
                    : "border-[#3c3c3c] bg-[#2d2d30] hover:border-[#454545]"
                }`}
                onClick={() => setSelectedAgentId(entry.agentId)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[#cccccc]">{entry.agentName}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-[#858585]">{entry.branchName}</div>
                  </div>
                  <StatusBadge label={entry.mergeReadiness} tone={toneForStatus(entry.mergeReadiness)} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusBadge label={entry.approval.status} tone={toneForStatus(entry.approval.status)} />
                  <StatusBadge label={entry.isolationStatus} tone={toneForStatus(entry.isolationStatus)} />
                  <StatusBadge label={entry.conflictState} tone={toneForStatus(entry.conflictState)} />
                </div>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div className="space-y-3">
        <QueueLaneDetail
          entry={selectedEntry}
          onApproveMerge={onApproveMerge}
          onFocusLane={onFocusLane}
          onRejectMerge={onRejectMerge}
          onRequestChanges={onRequestChanges}
        />
      </div>

      <div className="space-y-3">
        <Panel eyebrow="Checks" title="Reviewer and Tester Gates">
          <div className="space-y-1.5">
            {selectedEntry.checks.map((check) => (
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

        <Panel eyebrow="Isolation" title="Lane Metadata">
          <div className="space-y-1.5 text-sm text-[#cccccc]">
            <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2">
              Strategy: <span className="font-semibold">{selectedEntry.strategy}</span>
            </div>
            <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2">
              Worktree
              <div className="mt-0.5 font-mono text-[10px] text-[#858585]">{selectedEntry.worktreePath}</div>
            </div>
            <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2">
              Role: <span className="font-semibold">{selectedEntry.agentRole}</span>
            </div>
          </div>
        </Panel>

        <Panel eyebrow="Audit Trail" title="Decision History">
          <div className="space-y-1.5">
            {selectedEntry.approval.auditTrail.map((event) => (
              <div
                key={event.id}
                className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-[#cccccc]">{event.actor}</div>
                  <div className="text-[10px] text-[#858585]">{new Date(event.createdAt).toLocaleTimeString()}</div>
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-[#858585]">{event.action}</div>
                <p className="mt-1 text-sm text-[#cccccc]">{event.summary}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
