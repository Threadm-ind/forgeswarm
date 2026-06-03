import type { RecentRepositoryRecord, RepositoryInspection } from "@forgeswarm/shared";
import { Panel, StatusBadge } from "@forgeswarm/ui";

function validationTone(state: RepositoryInspection["validationState"] | RecentRepositoryRecord["validationState"]) {
  if (state === "valid") {
    return "success";
  }

  if (state === "unsupported" || state === "missing-path") {
    return "neutral";
  }

  return "warning";
}

export function HomeScreen({
  inspection,
  isInspecting,
  onContinue,
  onLoadDemo,
  onOpenFolder,
  onPathDraftChange,
  onSelectRecent,
  onValidatePath,
  pathDraft,
  pickerNotice,
  recentRepositories
}: {
  inspection: RepositoryInspection | null;
  isInspecting: boolean;
  onContinue: () => void;
  onLoadDemo: () => void;
  onOpenFolder: () => Promise<void>;
  onPathDraftChange: (path: string) => void;
  onSelectRecent: (path: string) => Promise<void>;
  onValidatePath: () => Promise<void>;
  pathDraft: string;
  pickerNotice: string | null;
  recentRepositories: RecentRepositoryRecord[];
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-[340px_minmax(0,1fr)_360px]">
      <Panel eyebrow="Recent Repositories" title="Quick Reopen">
        <div className="space-y-2">
          {recentRepositories.map((repository) => (
            <button
              key={repository.id}
              className="w-full rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-3 text-left transition hover:border-[#454545] hover:bg-[#37373d]"
              onClick={() => void onSelectRecent(repository.path)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-[#cccccc]">{repository.name}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-[#858585]">{repository.path}</div>
                </div>
                <StatusBadge
                  label={repository.validationState}
                  tone={validationTone(repository.validationState)}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {repository.stackBadges.map((badge) => (
                  <StatusBadge key={`${repository.id}:${badge.label}`} label={badge.label} tone="info" />
                ))}
              </div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel eyebrow="Repo Picker" title="Select Local Repository">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-sm font-medium text-blue-300 transition hover:border-blue-400/50 hover:bg-blue-500/15"
              onClick={() => void onOpenFolder()}
              type="button"
            >
              Open Folder
            </button>
            <button
              className="rounded border border-emerald-600/40 bg-emerald-600/10 px-3 py-1.5 text-sm font-medium text-emerald-300 transition hover:border-emerald-500/60 hover:bg-emerald-600/15"
              onClick={onLoadDemo}
              type="button"
            >
              Load Demo
            </button>
            <button
              className="rounded border border-[#454545] bg-[#3a3d41] px-3 py-1.5 text-sm font-medium text-[#cccccc] transition hover:border-[#555555] hover:bg-[#45494e]"
              disabled={isInspecting}
              onClick={() => void onValidatePath()}
              type="button"
            >
              {isInspecting ? "Validating..." : "Validate Path"}
            </button>
          </div>

          <div className="space-y-1.5">
            <label
              className="text-[11px] uppercase tracking-wider text-[#858585]"
              htmlFor="repo-path"
            >
              Repository Path
            </label>
            <input
              className="w-full rounded border border-[#3c3c3c] bg-[#1e1e1e] px-3 py-2 font-mono text-sm text-[#cccccc] outline-none transition focus:border-[#007acc]/60"
              id="repo-path"
              onChange={(event) => onPathDraftChange(event.target.value)}
              placeholder="C:/dev/my-repo"
              value={pathDraft}
            />
            <p className="text-[11px] text-[#858585]">
              In browser mode, use seeded recent repositories. In the native Tauri shell, arbitrary paths validate directly.
            </p>
            {pickerNotice ? <p className="text-[11px] text-amber-300">{pickerNotice}</p> : null}
          </div>

          <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-3">
            <div className="text-[11px] uppercase tracking-wider text-[#858585]">Goal</div>
            <p className="mt-1.5 text-sm text-[#cccccc]">
              Pick a Git repository, confirm its status, then carry validated context into swarm setup.
            </p>
          </div>
        </div>
      </Panel>

      <Panel
        eyebrow="Validation"
        title={inspection ? inspection.name : "Awaiting Inspection"}
        actions={
          inspection ? (
            <StatusBadge label={inspection.validationState} tone={validationTone(inspection.validationState)} />
          ) : null
        }
      >
        {inspection ? (
          <div className="space-y-3">
            <div className="font-mono text-[11px] text-[#858585]">{inspection.path || "No path selected yet."}</div>
            {inspection.stackBadges.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {inspection.stackBadges.map((badge) => (
                  <StatusBadge key={`${inspection.path}:${badge.label}`} label={badge.label} tone="info" />
                ))}
              </div>
            ) : null}
            {inspection.detectedFiles.length > 0 ? (
              <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-3">
                <div className="text-[11px] uppercase tracking-wider text-[#858585]">Detected Files</div>
                <div className="mt-2 space-y-1 font-mono text-[11px] text-[#cccccc]">
                  {inspection.detectedFiles.map((file) => (
                    <div key={`${inspection.path}:${file}`}>{file}</div>
                  ))}
                </div>
              </div>
            ) : null}
            {inspection.issues.length > 0 ? (
              <div className="rounded border border-amber-600/30 bg-amber-600/8 px-3 py-3 text-sm text-amber-300">
                {inspection.issues.map((issue) => (
                  <div key={`${inspection.path}:${issue.code}`}>{issue.message}</div>
                ))}
              </div>
            ) : null}
            <button
              className="rounded border border-emerald-600/40 bg-emerald-600/10 px-3 py-1.5 text-sm font-medium text-emerald-300 transition hover:border-emerald-500/60 hover:bg-emerald-600/15 disabled:cursor-not-allowed disabled:border-[#3c3c3c] disabled:bg-[#2d2d30] disabled:text-[#858585]"
              disabled={inspection.validationState !== "valid"}
              onClick={onContinue}
              type="button"
            >
              Continue to Swarm Setup →
            </button>
          </div>
        ) : (
          <div className="rounded border border-dashed border-[#3c3c3c] bg-[#2d2d30] px-4 py-6 text-sm text-[#858585]">
            Select a recent repository or validate a local path to see Git status, stack badges, and readiness.
          </div>
        )}
      </Panel>
    </div>
  );
}
