import {
  AGENT_COUNT_OPTIONS,
  AGENT_ROLES,
  createRepositoryLabel,
  type AgentCount,
  type AgentRole,
  type RepositoryInspection,
  type SwarmDraft
} from "@forgeswarm/shared";
import { Panel, StatusBadge } from "@forgeswarm/ui";

function PreferenceToggle({
  checked,
  description,
  label,
  onToggle
}: {
  checked: boolean;
  description: string;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      className={`flex w-full items-start justify-between rounded border px-3 py-2.5 text-left transition ${
        checked
          ? "border-[#007acc]/50 bg-[#007acc]/10"
          : "border-[#3c3c3c] bg-[#2d2d30] hover:border-[#454545]"
      }`}
      onClick={onToggle}
      type="button"
    >
      <div>
        <div className="text-sm font-medium text-[#cccccc]">{label}</div>
        <div className="mt-0.5 text-[11px] text-[#858585]">{description}</div>
      </div>
      <StatusBadge label={checked ? "On" : "Off"} tone={checked ? "info" : "neutral"} />
    </button>
  );
}

export function SwarmSetupScreen({
  activeRepository,
  draft,
  onAgentCountChange,
  onBack,
  onPromptChange,
  onRoleChange,
  onStart,
  onTogglePreference
}: {
  activeRepository: RepositoryInspection | null;
  draft: SwarmDraft;
  onAgentCountChange: (count: AgentCount) => void;
  onBack: () => void;
  onPromptChange: (prompt: string) => void;
  onRoleChange: (index: number, role: AgentRole) => void;
  onStart: () => void;
  onTogglePreference: (key: keyof SwarmDraft["preferences"]) => void;
}) {
  if (!activeRepository) {
    return (
      <Panel eyebrow="Swarm Setup" title="Repository Required">
        <div className="space-y-3">
          <p className="text-sm text-[#cccccc]">
            Validate a repository from the Home screen before configuring swarm roles and execution rules.
          </p>
          <button
            className="rounded border border-[#454545] bg-[#3a3d41] px-3 py-1.5 text-sm font-medium text-[#cccccc] transition hover:border-[#555555] hover:bg-[#45494e]"
            onClick={onBack}
            type="button"
          >
            Return to Home
          </button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
      <div className="space-y-3">
        <Panel eyebrow="Selected Repository" title={activeRepository.name}>
          <div className="space-y-2.5">
            <div className="text-sm text-[#cccccc]">
              {createRepositoryLabel({ name: activeRepository.name, branch: activeRepository.branch })}
            </div>
            <div className="font-mono text-[11px] text-[#858585]">{activeRepository.path}</div>
            <div className="flex flex-wrap gap-1.5">
              {activeRepository.stackBadges.map((badge) => (
                <StatusBadge key={`${activeRepository.path}:${badge.label}`} label={badge.label} tone="info" />
              ))}
            </div>
            <button
              className="rounded border border-[#454545] bg-[#3a3d41] px-3 py-1.5 text-sm font-medium text-[#cccccc] transition hover:border-[#555555] hover:bg-[#45494e]"
              onClick={onBack}
              type="button"
            >
              Change Repository
            </button>
          </div>
        </Panel>

        <Panel eyebrow="Draft Summary" title="Ready to Launch">
          <div className="space-y-2.5 text-sm text-[#cccccc]">
            <div className="text-[11px] text-[#858585]">
              <span className="text-[#cccccc] font-medium">{draft.agentCount}</span> agents ·{" "}
              <span className="text-[#cccccc] font-medium">{draft.roles.join(", ")}</span>
            </div>
            <div className="text-[11px] text-[#858585]">
              Approval gate:{" "}
              <span className="text-[#cccccc] font-medium">
                {draft.preferences.requireMergeApproval ? "enabled" : "disabled"}
              </span>
            </div>
            <button
              className="w-full rounded border border-emerald-600/40 bg-emerald-600/10 px-3 py-1.5 text-sm font-medium text-emerald-300 transition hover:border-emerald-500/60 hover:bg-emerald-600/15"
              onClick={onStart}
              type="button"
            >
              Launch Workspace
            </button>
          </div>
        </Panel>
      </div>

      <div className="space-y-3">
        <Panel eyebrow="Task Prompt" title="What Should the Swarm Do?">
          <div className="space-y-3">
            <textarea
              className="min-h-[200px] w-full rounded border border-[#3c3c3c] bg-[#1e1e1e] px-3 py-3 text-sm text-[#cccccc] outline-none transition focus:border-[#007acc]/60"
              onChange={(event) => onPromptChange(event.target.value)}
              placeholder="Implement supervised repo intake, agent setup, and a review-first merge workflow for the selected repository."
              value={draft.prompt}
            />
            <div className="rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2.5 text-[11px] text-[#858585]">
              Phase 2 only prepares the swarm draft. Execution, terminals, and merge flow arrive in later phases.
            </div>
          </div>
        </Panel>

        <Panel eyebrow="Agent Count" title="Capacity">
          <div className="flex flex-wrap gap-2">
            {AGENT_COUNT_OPTIONS.map((option) => (
              <button
                key={option}
                className={`rounded border px-3 py-1.5 text-sm font-medium transition ${
                  draft.agentCount === option
                    ? "border-[#007acc]/50 bg-[#007acc]/10 text-blue-300"
                    : "border-[#454545] bg-[#3a3d41] text-[#cccccc] hover:border-[#555555] hover:bg-[#45494e]"
                }`}
                onClick={() => onAgentCountChange(option)}
                type="button"
              >
                {option} agents
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div className="space-y-3">
        <Panel eyebrow="Role Roster" title="Assignments">
          <div className="space-y-2">
            {draft.roles.map((role, index) => (
              <label
                key={`${role}-${index}`}
                className="block rounded border border-[#3c3c3c] bg-[#2d2d30] px-3 py-2.5"
              >
                <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[#858585]">Agent {index + 1}</div>
                <select
                  className="w-full rounded border border-[#454545] bg-[#3a3d41] px-2 py-1.5 text-sm text-[#cccccc] outline-none transition focus:border-[#007acc]/60"
                  onChange={(event) => onRoleChange(index, event.target.value as AgentRole)}
                  value={role}
                >
                  {AGENT_ROLES.map((candidateRole) => (
                    <option key={candidateRole} value={candidateRole}>
                      {candidateRole}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </Panel>

        <Panel eyebrow="Execution Rules" title="Preferences">
          <div className="space-y-2">
            <PreferenceToggle
              checked={draft.preferences.autoRunTests}
              description="Run tester checks automatically once execution reaches verification."
              label="Auto-run tests"
              onToggle={() => onTogglePreference("autoRunTests")}
            />
            <PreferenceToggle
              checked={draft.preferences.requireMergeApproval}
              description="Block merge until a human explicitly approves the result."
              label="Require merge approval"
              onToggle={() => onTogglePreference("requireMergeApproval")}
            />
            <PreferenceToggle
              checked={draft.preferences.allowFileWrites}
              description="Allow builder lanes to stage repository changes once orchestration exists."
              label="Allow file writes"
              onToggle={() => onTogglePreference("allowFileWrites")}
            />
            <PreferenceToggle
              checked={draft.preferences.allowTerminalCommands}
              description="Permit shell command execution for agents in later workflow phases."
              label="Allow terminal commands"
              onToggle={() => onTogglePreference("allowTerminalCommands")}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}
