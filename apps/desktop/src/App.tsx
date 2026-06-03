import { startTransition, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { MockSwarmOrchestrator, type SwarmCommand } from "@forgeswarm/agent-runner";
import { invoke } from "@tauri-apps/api/core";
import {
  applyApprovalDecision,
  applyOrchestrationEvent,
  type AppSettingsRecord,
  createDefaultSwarmDraft,
  createMockWorkspaceSession,
  createRepositoryLabel,
  normalizeWorkspaceSession,
  type AppScreen,
  type AgentCount,
  type AgentRole,
  type PersistedAppState,
  type RecentRepositoryRecord,
  type RepositoryInspection,
  type SwarmDraft,
  type WorkspaceSession
} from "@forgeswarm/shared";
import { MetricPill } from "@forgeswarm/ui";

import { SideNav } from "./components/ScreenTabs";
import {
  createDefaultAppSettings,
  createDemoPersistedAppState,
  loadAppState,
  saveAppState,
  upsertRecentRepositories
} from "./lib/app-storage";
import { createDemoWorkspaceWithGit, synchronizeWorkspaceGitIsolation } from "./lib/git-isolation";
import { inspectRepositoryPath, pickRepositoryFolder } from "./lib/repository-service";
import { HomeScreen } from "./screens/HomeScreen";
import { MergeQueueScreen } from "./screens/MergeQueueScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SwarmSetupScreen } from "./screens/SwarmSetupScreen";
import { WorkspaceScreen } from "./screens/WorkspaceScreen";

export type Screen = AppScreen;

interface HealthCheckResponse {
  app: string;
  status: string;
  rust: string;
}

export default function App() {
  const orchestrator = useMemo(() => new MockSwarmOrchestrator(), []);
  const startedWorkspaceIdRef = useRef<string | null>(null);
  const gitIsolationSyncRef = useRef<string | null>(null);

  const [activeScreen, setActiveScreen] = useState<Screen>("Home");
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [recentRepositories, setRecentRepositories] = useState<RecentRepositoryRecord[]>([]);
  const [pathDraft, setPathDraft] = useState("");
  const [inspection, setInspection] = useState<RepositoryInspection | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [pickerNotice, setPickerNotice] = useState<string | null>(null);
  const [swarmDraft, setSwarmDraft] = useState<SwarmDraft>(() => createDefaultSwarmDraft(4));
  const [workspaceSession, setWorkspaceSession] = useState<WorkspaceSession | null>(null);
  const [settings, setSettings] = useState(createDefaultAppSettings());

  const activeRepository = useMemo(
    () => (inspection?.validationState === "valid" ? inspection : null),
    [inspection]
  );

  const handleOrchestrationEvent = useEffectEvent((event: Parameters<MockSwarmOrchestrator["subscribe"]>[0] extends (arg: infer T) => void ? T : never) => {
    setWorkspaceSession((current) => {
      if (!current) {
        return current;
      }

      return normalizeWorkspaceSession(applyOrchestrationEvent(current, event));
    });
  });

  useEffect(() => {
    const unsubscribe = orchestrator.subscribe(handleOrchestrationEvent);

    return () => {
      unsubscribe();
      orchestrator.dispose();
    };
  }, [handleOrchestrationEvent, orchestrator]);

  useEffect(() => {
    let cancelled = false;

    invoke<HealthCheckResponse>("health_check")
      .then((response) => {
        if (!cancelled) {
          setHealth(response);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setHealthError(error instanceof Error ? error.message : "Tauri backend unavailable");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadAppState().then((state) => {
      if (cancelled) {
        return;
      }

      applyPersistedState(state);
      setIsBootstrapped(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isBootstrapped) {
      return;
    }

    void saveAppState({
      recentRepositories,
      selectedRepositoryInspection: inspection,
      swarmDraft,
      workspaceSession,
      pathDraft,
      lastScreen: activeScreen,
      settings
    });
  }, [activeScreen, inspection, isBootstrapped, pathDraft, recentRepositories, settings, swarmDraft, workspaceSession]);

  useEffect(() => {
    if (!workspaceSession) {
      startedWorkspaceIdRef.current = null;
      gitIsolationSyncRef.current = null;
      return;
    }

    if (startedWorkspaceIdRef.current === workspaceSession.id) {
      return;
    }

    startedWorkspaceIdRef.current = workspaceSession.id;
    orchestrator.start(workspaceSession);
  }, [orchestrator, workspaceSession]);

  useEffect(() => {
    if (!workspaceSession) {
      gitIsolationSyncRef.current = null;
      return;
    }

    if (gitIsolationSyncRef.current === workspaceSession.id) {
      return;
    }

    gitIsolationSyncRef.current = workspaceSession.id;
    let cancelled = false;

    void synchronizeWorkspaceGitIsolation(workspaceSession).then((nextWorkspace) => {
      if (cancelled) {
        return;
      }

      setWorkspaceSession((current) => (current?.id === nextWorkspace.id ? normalizeWorkspaceSession(nextWorkspace) : current));
    });

    return () => {
      cancelled = true;
    };
  }, [workspaceSession]);

  async function validateRepository(path: string) {
    setIsInspecting(true);
    setPickerNotice(null);

    try {
      const result = await inspectRepositoryPath(path);
      setInspection(result);
      setRecentRepositories((current) => upsertRecentRepositories(current, result, "manual"));

      if (result.validationState === "valid") {
        startTransition(() => {
          setActiveScreen("Swarm Setup");
        });
      } else {
        startTransition(() => {
          setActiveScreen("Home");
        });
      }
    } finally {
      setIsInspecting(false);
    }
  }

  async function handleOpenFolder() {
    const selectedPath = await pickRepositoryFolder();

    if (!selectedPath) {
      setPickerNotice(
        "Native folder picking is unavailable in browser verification mode. Choose a seeded recent repository or paste a local path."
      );
      return;
    }

    setPathDraft(selectedPath);
    await validateRepository(selectedPath);
  }

  function handleAgentCountChange(agentCount: AgentCount) {
    setSwarmDraft((current) => {
      const nextDraft = createDefaultSwarmDraft(agentCount);

      return {
        ...current,
        agentCount,
        roles: nextDraft.roles
      };
    });
  }

  function handleRoleChange(index: number, role: AgentRole) {
    setSwarmDraft((current) => ({
      ...current,
      roles: current.roles.map((currentRole, roleIndex) => (roleIndex === index ? role : currentRole))
    }));
  }

  function handlePreferenceToggle(key: keyof SwarmDraft["preferences"]) {
    setSwarmDraft((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        [key]: !current.preferences[key]
      }
    }));
  }

  function handleStartWorkspace() {
    if (!activeRepository) {
      return;
    }

    startedWorkspaceIdRef.current = null;
    gitIsolationSyncRef.current = null;
    setWorkspaceSession(createDemoWorkspaceWithGit(createMockWorkspaceSession(activeRepository, swarmDraft)));
    setActiveScreen("Workspace");
  }

  function handleLoadDemo() {
    applyPersistedState(createDemoPersistedAppState());
    setPickerNotice(null);
  }

  function handleSelectAgent(agentId: string) {
    setWorkspaceSession((current) => (current ? { ...current, activeAgentId: agentId } : current));
  }

  async function handleCommand(command: SwarmCommand) {
    await orchestrator.dispatch(command);
  }

  function handlePauseAgent(agentId: string) {
    void handleCommand({ type: "pause", agentId });
  }

  function handleResumeAgent(agentId: string) {
    void handleCommand({ type: "resume", agentId });
  }

  function handleStopAgent(agentId: string) {
    void handleCommand({ type: "stop", agentId });
  }

  function handleSendMessage(agentId: string, body: string) {
    void handleCommand({ type: "message", agentId, body });
  }

  function handleRunRollCall() {
    void handleCommand({ type: "run-roll-call" });
  }

  function handleReviewDecision(
    agentId: string,
    status: "approved" | "rejected" | "changes-requested"
  ) {
    setWorkspaceSession((current) =>
      current
        ? normalizeWorkspaceSession(
            applyApprovalDecision(current, {
              actor: "Operator",
              agentId,
              status
            })
          )
        : current
    );
  }

  function handleOpenMergeQueue(agentId?: string) {
    if (agentId) {
      handleSelectAgent(agentId);
    }

    setActiveScreen("Merge Queue");
  }

  function handleSettingChange<K extends keyof AppSettingsRecord>(key: K, value: AppSettingsRecord[K]) {
    setSettings((current) => ({
      ...current,
      [key]: value
    }));
  }

  function applyPersistedState(state: PersistedAppState) {
    startedWorkspaceIdRef.current = null;
    gitIsolationSyncRef.current = null;
    setRecentRepositories(state.recentRepositories);
    setInspection(state.selectedRepositoryInspection);
    setSwarmDraft(state.swarmDraft);
    setWorkspaceSession(normalizeWorkspaceSession(state.workspaceSession));
    setPathDraft(state.pathDraft);
    setActiveScreen(state.lastScreen);
    setSettings(state.settings);
  }

  const repositoryPill = activeRepository
    ? createRepositoryLabel({ name: activeRepository.name, branch: activeRepository.branch })
    : "no repo";
  const stagePill = workspaceSession?.orchestrationStage ?? inspection?.validationState ?? "idle";
  const providerPill = settings.providerPlaceholder ?? "mock-provider";

  return (
    <div className="flex h-screen flex-col bg-[#1e1e1e] text-[#cccccc]">
      {/* Title bar */}
      <div className="flex h-8 shrink-0 items-center gap-3 border-b border-[#3c3c3c] bg-[#323233] px-4">
        <span className="text-[12px] font-semibold text-[#cccccc]">ForgeSwarm</span>
        <span className="text-[11px] text-[#858585]">Supervised Parallel Coding</span>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <SideNav activeScreen={activeScreen} onSelect={setActiveScreen} />

        <main className="flex-1 overflow-auto p-4">
          {activeScreen === "Home" ? (
            <HomeScreen
              inspection={inspection}
              isInspecting={isInspecting}
              onContinue={() => setActiveScreen("Swarm Setup")}
              onOpenFolder={handleOpenFolder}
              onPathDraftChange={setPathDraft}
              onLoadDemo={handleLoadDemo}
              onSelectRecent={async (path) => {
                setPathDraft(path);
                await validateRepository(path);
              }}
              onValidatePath={async () => {
                await validateRepository(pathDraft);
              }}
              pathDraft={pathDraft}
              pickerNotice={pickerNotice}
              recentRepositories={recentRepositories}
            />
          ) : null}

          {activeScreen === "Swarm Setup" ? (
            <SwarmSetupScreen
              activeRepository={activeRepository}
              draft={swarmDraft}
              onAgentCountChange={handleAgentCountChange}
              onBack={() => setActiveScreen("Home")}
              onPromptChange={(prompt) => setSwarmDraft((current) => ({ ...current, prompt }))}
              onRoleChange={handleRoleChange}
              onStart={handleStartWorkspace}
              onTogglePreference={handlePreferenceToggle}
            />
          ) : null}

          {activeScreen === "Workspace" ? (
            <WorkspaceScreen
              health={health}
              healthError={healthError}
              onApproveMerge={(agentId) => handleReviewDecision(agentId, "approved")}
              onOpenMergeQueue={handleOpenMergeQueue}
              onPauseAgent={handlePauseAgent}
              onRejectMerge={(agentId) => handleReviewDecision(agentId, "rejected")}
              onRequestChanges={(agentId) => handleReviewDecision(agentId, "changes-requested")}
              onResumeAgent={handleResumeAgent}
              onRunRollCall={handleRunRollCall}
              onSelectAgent={handleSelectAgent}
              onSendMessage={handleSendMessage}
              onStopAgent={handleStopAgent}
              workspaceSession={workspaceSession}
            />
          ) : null}

          {activeScreen === "Merge Queue" ? (
            <MergeQueueScreen
              onApproveMerge={(agentId) => handleReviewDecision(agentId, "approved")}
              onFocusLane={(agentId) => {
                handleSelectAgent(agentId);
                setActiveScreen("Workspace");
              }}
              onRejectMerge={(agentId) => handleReviewDecision(agentId, "rejected")}
              onRequestChanges={(agentId) => handleReviewDecision(agentId, "changes-requested")}
              workspaceSession={workspaceSession}
            />
          ) : null}

          {activeScreen === "Settings" ? (
            <SettingsScreen
              activeRepository={activeRepository}
              health={health}
              healthError={healthError}
              onSettingChange={handleSettingChange}
              settings={settings}
              workspaceSession={workspaceSession}
            />
          ) : null}
        </main>
      </div>

      {/* Status bar */}
      <div className="flex h-[22px] shrink-0 items-center gap-6 border-t border-[#3c3c3c] bg-[#007acc] px-3">
        <MetricPill label="repo" value={repositoryPill} />
        <MetricPill label="stage" value={stagePill} />
        <MetricPill label="provider" value={providerPill} />
      </div>
    </div>
  );
}
