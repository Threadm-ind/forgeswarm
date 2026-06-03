import type { AppSettingsRecord, RepositoryInspection, WorkspaceSession } from "@forgeswarm/shared";
import { Panel, StatusBadge } from "@forgeswarm/ui";

function optionButtonClass(isActive: boolean) {
  return isActive
    ? "border-[#007acc]/50 bg-[#007acc]/10 text-blue-300"
    : "border-[#3c3c3c] bg-[#2d2d30] text-[#cccccc] hover:border-[#454545]";
}

function providerLabel(value: NonNullable<AppSettingsRecord["providerPlaceholder"]>) {
  if (value === "openai-compatible") {
    return "OpenAI Compatible";
  }

  if (value === "anthropic-compatible") {
    return "Anthropic Compatible";
  }

  if (value === "local-model") {
    return "Local Model";
  }

  return "Mock Provider";
}

export function SettingsScreen({
  activeRepository,
  health,
  healthError,
  onSettingChange,
  settings,
  workspaceSession
}: {
  activeRepository: RepositoryInspection | null;
  health: { app: string; status: string; rust: string } | null;
  healthError: string | null;
  onSettingChange: <K extends keyof AppSettingsRecord>(key: K, value: AppSettingsRecord[K]) => void;
  settings: AppSettingsRecord;
  workspaceSession: WorkspaceSession | null;
}) {
  const protectedBranch = workspaceSession?.gitIsolation?.protectedBranch.name ?? activeRepository?.branch ?? "main";

  return (
    <div className="grid gap-3 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
      <div className="space-y-3">
        <Panel eyebrow="Local Preferences" title="Appearance">
          <div className="space-y-2.5">
            <p className="text-sm text-[#cccccc]">
              Keep the console dense and operational. Appearance remains local to this workstation.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(["dark", "system"] as const).map((option) => (
                <button
                  key={option}
                  className={`rounded border px-3 py-2.5 text-sm transition ${optionButtonClass(settings.appearance === option)}`}
                  onClick={() => onSettingChange("appearance", option)}
                  type="button"
                >
                  {option === "dark" ? "Dark Console" : "Follow System"}
                </button>
              ))}
            </div>
          </div>
        </Panel>

        <Panel eyebrow="Shortcuts" title="Keyboard Preset">
          <div className="space-y-2.5">
            <p className="text-sm text-[#cccccc]">
              Shortcut handling stays intentionally lightweight in the MVP, but the preset is persisted for later expansion.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(["default", "commander"] as const).map((option) => (
                <button
                  key={option}
                  className={`rounded border px-3 py-2.5 text-sm transition ${optionButtonClass(settings.keyboardShortcuts === option)}`}
                  onClick={() => onSettingChange("keyboardShortcuts", option)}
                  type="button"
                >
                  {option === "default" ? "Default" : "Commander"}
                </button>
              ))}
            </div>
          </div>
        </Panel>

        <Panel eyebrow="Permissions" title="Repository Access">
          <div className="space-y-2.5">
            <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2 font-mono text-sm text-[#858585]">
              protected: <span className="font-semibold text-[#cccccc]">{protectedBranch}</span>
            </div>
            <div className="space-y-1.5">
              {([
                { value: "per-repo", label: "Per Repo", detail: "Remember approval posture and preferences per repository." },
                { value: "session-only", label: "Session Only", detail: "Keep repo access ephemeral for the current operator session." }
              ] as const).map((option) => (
                <button
                  key={option.value}
                  className={`w-full rounded border px-3 py-2.5 text-left transition ${optionButtonClass(settings.repoPermissions === option.value)}`}
                  onClick={() => onSettingChange("repoPermissions", option.value)}
                  type="button"
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="mt-0.5 text-[11px] text-[#858585]">{option.detail}</div>
                </button>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="space-y-3">
        <Panel eyebrow="Provider Placeholders" title="Routing Surface">
          <div className="space-y-2.5">
            <p className="text-sm text-[#cccccc]">
              ForgeSwarm is still mock-first. These selections shape future routing intent without claiming live model integration.
            </p>
            <div className="space-y-1.5">
              {(["mock-provider", "openai-compatible", "anthropic-compatible", "local-model"] as const).map((option) => (
                <button
                  key={option}
                  className={`w-full rounded border px-3 py-2.5 text-left transition ${optionButtonClass(settings.providerPlaceholder === option)}`}
                  onClick={() => onSettingChange("providerPlaceholder", option)}
                  type="button"
                >
                  <div className="text-sm font-medium">{providerLabel(option)}</div>
                  <div className="mt-0.5 text-[11px] text-[#858585]">
                    {option === "mock-provider"
                      ? "Believable demo routing with no live provider dependency."
                      : option === "local-model"
                        ? "Reserve the UI contract for local-hosted backends later."
                        : "Placeholder routing label only. No live provider calls are made in this MVP."}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Panel>

        <Panel eyebrow="Workspace Context" title="Current Operating Surface">
          <div className="space-y-2 text-sm text-[#cccccc]">
            <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-[#858585]">Repository</div>
              <div className="mt-0.5 font-mono text-[11px] text-[#858585]">
                {activeRepository?.path ?? "No validated repository selected."}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-[#858585]">Screen</div>
                <div className="mt-0.5 text-sm font-semibold text-[#cccccc]">Settings</div>
              </div>
              <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-[#858585]">Active Mode</div>
                <div className="mt-0.5 text-sm font-semibold text-[#cccccc]">
                  {workspaceSession ? workspaceSession.orchestrationStage : "idle"}
                </div>
              </div>
            </div>
            <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-[#cccccc]">Selected Provider</div>
                <StatusBadge label={providerLabel(settings.providerPlaceholder ?? "mock-provider")} tone="info" />
              </div>
              <p className="mt-1 text-[11px] text-[#858585]">
                These settings persist locally so the operator console can keep a stable environment between runs.
              </p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="space-y-3">
        <Panel eyebrow="Native Shell" title="Environment Status">
          <div className="space-y-2 text-sm text-[#cccccc]">
            <div>{health ? `${health.app} backend ${health.status} on ${health.rust}` : "Waiting for native shell"}</div>
            {healthError ? <div className="text-[11px] text-amber-300">{healthError}</div> : null}
            <div className="rounded border border-amber-600/30 bg-amber-600/8 px-3 py-2.5 text-sm text-amber-300">
              Native Tauri verification on this machine is blocked by missing Rust and MSVC Build Tools.
            </div>
          </div>
        </Panel>

        <Panel eyebrow="Delivery Notes" title="MVP Posture">
          <div className="space-y-1.5 text-sm text-[#858585]">
            <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2.5">
              Local-first persistence and mock orchestration are complete enough for demos and supervised workflow walkthroughs.
            </div>
            <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2.5">
              Main stays protected. Approval and merge review remain explicit, visible, and confirmation-oriented.
            </div>
            <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2.5">
              Provider settings remain placeholders only, keeping the MVP extensible without overclaiming autonomy.
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
