import { createRepositoryLabel, type RepositoryInspection, type SwarmDraft, type WorkspaceSession } from "@forgeswarm/shared";
import { Panel, StatusBadge } from "@forgeswarm/ui";

import type { Screen } from "../App";

const timeline = [
  "Settings still remain local-only and intentionally lightweight in the MVP.",
  "Provider configuration is placeholder-only until real backend integration lands.",
  "Keyboard shortcuts and appearance are visible now, but deeper polish remains phase 8 work."
];

const checks = ["lint", "typecheck", "build"] as const;

export function PlaceholderScreen({
  activeRepository,
  health,
  healthError,
  screen,
  swarmDraft,
  workspaceSession
}: {
  activeRepository: RepositoryInspection | null;
  health: { app: string; status: string; rust: string } | null;
  healthError: string | null;
  screen: Screen;
  swarmDraft: SwarmDraft;
  workspaceSession: WorkspaceSession | null;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <Panel eyebrow="Repository Context" title="Selected Repo">
          {activeRepository ? (
            <div className="space-y-3">
              <div className="text-sm text-slate-100">
                {createRepositoryLabel({ name: activeRepository.name, branch: activeRepository.branch })}
              </div>
              <div className="text-xs text-slate-500">{activeRepository.path}</div>
              <div className="flex flex-wrap gap-2">
                {activeRepository.stackBadges.map((badge) => (
                  <StatusBadge key={`${activeRepository.path}:${badge.label}`} label={badge.label} tone="info" />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400">No validated repository selected yet.</div>
          )}
        </Panel>

        <Panel eyebrow="Draft Swarm" title="Current Setup">
          <div className="space-y-2 text-sm text-slate-300">
            <div>Agent count: {swarmDraft.agentCount}</div>
            <div>Roles: {swarmDraft.roles.join(", ")}</div>
            <div>Prompt: {swarmDraft.prompt.trim() ? "Ready" : "Still empty"}</div>
            <div>Workspace hydrated: {workspaceSession ? "yes" : "not yet"}</div>
          </div>
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel eyebrow={screen} title="Reserved Workspace">
          <div className="rounded-2xl border border-slate-800 bg-black/40 p-4 font-mono text-[12px] leading-6 text-slate-300">
            <div>$ coordinator.plan --screen {screen.toLowerCase().replace(/\s+/g, "-")}</div>
            <div>&gt; Settings remain intentionally narrow until the delivery phase.</div>
            <div>&gt; Repo permissions, keyboard shortcuts, and provider placeholders stay local-first.</div>
          </div>
        </Panel>

        <Panel eyebrow="Timeline" title="Reserved Event Stream">
          <div className="space-y-3">
            {timeline.map((entry, index) => (
              <div
                key={entry}
                className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3"
              >
                <div className="mt-0.5 h-2.5 w-2.5 rounded-full bg-cyan-300" />
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Event {index + 1}</div>
                  <p className="mt-1 text-sm text-slate-300">{entry}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel eyebrow="Native Shell" title="Tauri Health">
          <div className="space-y-2 text-sm text-slate-300">
            <div>{health ? `${health.app} backend ${health.status} on ${health.rust}` : "Waiting for native shell"}</div>
            {healthError ? <div className="text-xs text-amber-300">{healthError}</div> : null}
          </div>
        </Panel>

        <Panel eyebrow="Checks" title="Future Merge Gate">
          <div className="space-y-3">
            {checks.map((check) => (
              <div
                key={check}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3"
              >
                <span className="text-sm text-slate-200">{check}</span>
                <StatusBadge label="phase-8" tone="neutral" />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
