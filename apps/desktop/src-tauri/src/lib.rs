use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HealthCheck {
    app: &'static str,
    status: &'static str,
    rust: &'static str,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StackBadge {
    label: String,
    confidence: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RepositoryValidationIssue {
    code: String,
    message: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RepositoryInspection {
    path: String,
    name: String,
    branch: Option<String>,
    validation_state: String,
    stack_badges: Vec<StackBadge>,
    detected_files: Vec<String>,
    issues: Vec<RepositoryValidationIssue>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecentRepositoryRecord {
    id: String,
    name: String,
    path: String,
    branch: Option<String>,
    validation_state: String,
    stack_badges: Vec<StackBadge>,
    last_opened_at: Option<String>,
    source: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SwarmPreferences {
    auto_run_tests: bool,
    require_merge_approval: bool,
    allow_file_writes: bool,
    allow_terminal_commands: bool,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SwarmDraft {
    prompt: String,
    agent_count: u8,
    roles: Vec<String>,
    preferences: SwarmPreferences,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentRecord {
    id: String,
    swarm_id: String,
    name: String,
    role: String,
    status: String,
    branch_name: String,
    worktree_path: String,
    touched_files: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentGitSessionRecord {
    agent_id: String,
    strategy: String,
    branch_name: String,
    worktree_path: String,
    base_branch: String,
    status: String,
    conflict_state: String,
    exists: bool,
    note: String,
    last_synced_at: Option<String>,
    reset_available: bool,
    rollback_available: bool,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskRecord {
    id: String,
    swarm_id: String,
    agent_id: Option<String>,
    title: String,
    status: String,
    summary: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CheckRunRecord {
    id: String,
    swarm_id: String,
    agent_id: Option<String>,
    name: String,
    status: String,
    summary: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CoordinatorPlanItem {
    id: String,
    title: String,
    status: String,
    owner_role: String,
    note: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TimelineEventRecord {
    id: String,
    agent_id: Option<String>,
    timestamp: String,
    title: String,
    detail: String,
    tone: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TerminalLineRecord {
    id: String,
    kind: String,
    text: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TerminalSessionRecord {
    id: String,
    agent_id: String,
    title: String,
    cwd: String,
    lines: Vec<TerminalLineRecord>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TouchedFileRecord {
    path: String,
    change_type: String,
    agent_id: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiffSummaryRecord {
    id: String,
    agent_id: String,
    title: String,
    summary: String,
    files_changed: i64,
    additions: i64,
    deletions: i64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiffFileRecord {
    path: String,
    change_type: String,
    additions: i64,
    deletions: i64,
    note: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiffSectionRecord {
    id: String,
    title: String,
    summary: String,
    risk: String,
    files: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReviewAuditRecord {
    id: String,
    created_at: String,
    actor: String,
    action: String,
    summary: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApprovalRecord {
    id: String,
    swarm_id: String,
    agent_id: String,
    branch_name: String,
    status: String,
    requested_by_agent_id: String,
    requested_at: String,
    decided_at: Option<String>,
    decided_by: Option<String>,
    summary: String,
    comment: Option<String>,
    audit_trail: Vec<ReviewAuditRecord>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceCommentRecord {
    id: String,
    author: String,
    body: String,
    created_at: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MessageRecord {
    id: String,
    swarm_id: String,
    agent_id: Option<String>,
    direction: String,
    author_label: String,
    recipient_label: Option<String>,
    body: String,
    created_at: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RollCallAgentStatusRecord {
    agent_id: String,
    agent_name: String,
    status: String,
    note: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SwarmRollCallRecord {
    id: String,
    requested_at: String,
    completed_at: Option<String>,
    initiated_by: String,
    status: String,
    summary: String,
    agent_statuses: Vec<RollCallAgentStatusRecord>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProtectedBranchRecord {
    name: String,
    is_protected: bool,
    current_branch: Option<String>,
    detached_head: bool,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitRepositoryStatusRecord {
    repository_path: String,
    current_branch: Option<String>,
    protected_branch: String,
    supports_worktrees: bool,
    is_dirty: bool,
    has_conflicts: bool,
    detached_head: bool,
    git_available: bool,
    warnings: Vec<String>,
    errors: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitIsolationPlanRecord {
    repository_path: String,
    strategy: String,
    status: String,
    protected_branch: ProtectedBranchRecord,
    repository_status: GitRepositoryStatusRecord,
    warnings: Vec<String>,
    errors: Vec<String>,
    workspaces: Vec<AgentGitSessionRecord>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceAgentSession {
    agent: AgentRecord,
    #[serde(default)]
    git: Option<AgentGitSessionRecord>,
    terminal: TerminalSessionRecord,
    touched_files: Vec<TouchedFileRecord>,
    tasks: Vec<TaskRecord>,
    timeline: Vec<TimelineEventRecord>,
    diff_summary: DiffSummaryRecord,
    #[serde(default)]
    diff_files: Vec<DiffFileRecord>,
    #[serde(default)]
    diff_sections: Vec<DiffSectionRecord>,
    checks: Vec<CheckRunRecord>,
    #[serde(default)]
    approval: Option<ApprovalRecord>,
    comments: Vec<WorkspaceCommentRecord>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BranchDiffDetailRecord {
    branch_name: String,
    target_branch: String,
    summary: String,
    files: Vec<DiffFileRecord>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MergeReadinessRecord {
    branch_name: String,
    target_branch: String,
    status: String,
    summary: String,
    reasons: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceSession {
    id: String,
    repository: RepositoryInspection,
    swarm_draft: SwarmDraft,
    status: String,
    #[serde(default)]
    orchestration_stage: Option<String>,
    active_agent_id: String,
    coordinator_plan: Vec<CoordinatorPlanItem>,
    global_timeline: Vec<TimelineEventRecord>,
    #[serde(default)]
    messages: Vec<MessageRecord>,
    #[serde(default)]
    last_roll_call: Option<SwarmRollCallRecord>,
    #[serde(default)]
    git_isolation: Option<GitIsolationPlanRecord>,
    agents: Vec<WorkspaceAgentSession>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettingsRecord {
    appearance: String,
    keyboard_shortcuts: String,
    provider_placeholder: Option<String>,
    repo_permissions: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedAppState {
    recent_repositories: Vec<RecentRepositoryRecord>,
    selected_repository_inspection: Option<RepositoryInspection>,
    swarm_draft: SwarmDraft,
    workspace_session: Option<WorkspaceSession>,
    path_draft: String,
    last_screen: String,
    settings: AppSettingsRecord,
}

#[tauri::command]
fn health_check() -> HealthCheck {
    HealthCheck {
        app: "ForgeSwarm",
        status: "ready",
        rust: env!("CARGO_PKG_VERSION"),
    }
}

#[tauri::command]
fn inspect_repository(path: String) -> RepositoryInspection {
    let trimmed_path = path.trim();

    if trimmed_path.is_empty() {
        return RepositoryInspection {
            path: String::new(),
            name: "Unselected repository".into(),
            branch: None,
            validation_state: "missing-path".into(),
            stack_badges: Vec::new(),
            detected_files: Vec::new(),
            issues: vec![RepositoryValidationIssue {
                code: "missing-path".into(),
                message: "Enter a repository path before validating.".into(),
            }],
        };
    }

    let repository_path = PathBuf::from(trimmed_path);
    let repository_name = repository_path
        .file_name()
        .and_then(|value| value.to_str())
        .map_or_else(|| "Selected repository".to_string(), ToString::to_string);

    if !repository_path.exists() || !repository_path.is_dir() {
        return RepositoryInspection {
            path: trimmed_path.into(),
            name: repository_name,
            branch: None,
            validation_state: "unreadable".into(),
            stack_badges: Vec::new(),
            detected_files: Vec::new(),
            issues: vec![RepositoryValidationIssue {
                code: "unreadable".into(),
                message: "The selected path does not exist or is not a directory.".into(),
            }],
        };
    }

    if !has_git_marker(&repository_path) {
        let (stack_badges, detected_files) = detect_stack(&repository_path);

        return RepositoryInspection {
            path: repository_path.to_string_lossy().to_string(),
            name: repository_name,
            branch: None,
            validation_state: "missing-git".into(),
            stack_badges,
            detected_files,
            issues: vec![RepositoryValidationIssue {
                code: "missing-git".into(),
                message: "The selected folder does not contain a Git repository.".into(),
            }],
        };
    }

    let (stack_badges, detected_files) = detect_stack(&repository_path);

    RepositoryInspection {
        path: repository_path.to_string_lossy().to_string(),
        name: repository_name,
        branch: detect_branch(&repository_path),
        validation_state: "valid".into(),
        stack_badges,
        detected_files,
        issues: Vec::new(),
    }
}

#[tauri::command]
fn inspect_git_repository(path: String) -> Result<GitRepositoryStatusRecord, String> {
    let repository_path = PathBuf::from(path.trim());

    if !repository_path.exists() || !repository_path.is_dir() {
        return Err("The selected repository path does not exist or is not a directory.".into());
    }

    if !has_git_marker(&repository_path) {
        return Err("The selected folder does not contain a Git repository.".into());
    }

    let git_available = command_available("git");
    let current_branch = if git_available {
        git_stdout(&repository_path, &["rev-parse", "--abbrev-ref", "HEAD"]).ok()
    } else {
        detect_branch(&repository_path)
    };
    let detached_head = current_branch.as_deref() == Some("HEAD")
        || current_branch.as_deref() == Some("detached")
        || current_branch.is_none();
    let protected_branch = current_branch
        .clone()
        .filter(|branch| branch != "HEAD" && branch != "detached")
        .unwrap_or_else(|| "main".into());
    let status_output = if git_available {
        git_stdout(&repository_path, &["status", "--porcelain"]).unwrap_or_default()
    } else {
        String::new()
    };
    let conflict_output = if git_available {
        git_stdout(&repository_path, &["diff", "--name-only", "--diff-filter=U"]).unwrap_or_default()
    } else {
        String::new()
    };
    let supports_worktrees = git_available
        && git_stdout(&repository_path, &["worktree", "list"]).is_ok()
        && !detached_head;
    let is_dirty = !status_output.trim().is_empty();
    let has_conflicts = !conflict_output.trim().is_empty()
        || status_output
            .lines()
            .any(|line| line.starts_with("UU") || line.starts_with("AA"));
    let mut warnings = Vec::new();
    let mut errors = Vec::new();

    if !git_available {
        errors.push("Git CLI is not available in the native shell environment.".into());
    }

    if detached_head {
        warnings.push("Repository HEAD is detached. Worktree isolation will fall back to branch-safe planning.".into());
    }

    if is_dirty {
        warnings.push("Repository has uncommitted changes on the protected branch.".into());
    }

    if has_conflicts {
        errors.push("Repository has unresolved merge conflicts.".into());
    }

    Ok(GitRepositoryStatusRecord {
        repository_path: repository_path.to_string_lossy().to_string(),
        current_branch,
        protected_branch,
        supports_worktrees,
        is_dirty,
        has_conflicts,
        detached_head,
        git_available,
        warnings,
        errors,
    })
}

#[tauri::command]
fn setup_git_isolation(path: String, plan: GitIsolationPlanRecord) -> Result<GitIsolationPlanRecord, String> {
    let repository_path = PathBuf::from(path.trim());

    if !repository_path.exists() || !repository_path.is_dir() {
        return Err("The selected repository path does not exist or is not a directory.".into());
    }

    if !has_git_marker(&repository_path) {
        return Err("The selected folder does not contain a Git repository.".into());
    }

    if !command_available("git") {
        return Ok(mark_plan_unavailable(
            plan,
            "Git CLI is unavailable in the native shell environment.",
        ));
    }

    let mut next_plan = plan.clone();
    let mut warnings = next_plan.warnings.clone();
    let mut errors = next_plan.errors.clone();

    for workspace in next_plan.workspaces.iter_mut() {
        if let Err(error) = ensure_branch_exists(
            &repository_path,
            &workspace.branch_name,
            &workspace.base_branch,
        ) {
            workspace.status = "error".into();
            workspace.note = error.clone();
            workspace.exists = false;
            workspace.last_synced_at = Some(now_iso());
            errors.push(error);
            continue;
        }

        if workspace.strategy == "worktree" {
            match ensure_worktree_exists(&repository_path, &workspace.worktree_path, &workspace.branch_name) {
                Ok(note) => {
                    workspace.status = "ready".into();
                    workspace.note = note;
                    workspace.exists = true;
                }
                Err(error) => {
                    workspace.status = "warning".into();
                    workspace.note = error.clone();
                    workspace.exists = false;
                    warnings.push(error);
                }
            }
        } else {
            workspace.status = "ready".into();
            workspace.note = format!(
                "Isolated branch {} is ready. Worktree creation is deferred for this lane.",
                workspace.branch_name
            );
            workspace.exists = true;
        }

        workspace.last_synced_at = Some(now_iso());
    }

    next_plan.warnings = dedupe_lines(warnings);
    next_plan.errors = dedupe_lines(errors);
    next_plan.status = if !next_plan.errors.is_empty() {
        "error".into()
    } else if !next_plan.warnings.is_empty() {
        "warning".into()
    } else {
        "ready".into()
    };

    Ok(next_plan)
}

#[tauri::command]
fn get_branch_diff_detail(
    path: String,
    branch_name: String,
    target_branch: String,
) -> Result<BranchDiffDetailRecord, String> {
    let repository_path = PathBuf::from(path.trim());

    if !repository_path.exists() || !repository_path.is_dir() {
        return Err("The selected repository path does not exist or is not a directory.".into());
    }

    if !has_git_marker(&repository_path) {
        return Err("The selected folder does not contain a Git repository.".into());
    }

    if !command_available("git") {
        return Err("Git CLI is unavailable in the native shell environment.".into());
    }

    let range = format!("{}..{}", target_branch, branch_name);
    let diff_output = git_stdout(&repository_path, &["diff", "--numstat", &range]).unwrap_or_default();
    let files = diff_output
        .lines()
        .filter_map(|line| {
            let mut parts = line.split('\t');
            let additions = parts.next()?.parse::<i64>().ok().unwrap_or(0);
            let deletions = parts.next()?.parse::<i64>().ok().unwrap_or(0);
            let path = parts.next()?.to_string();

            Some(DiffFileRecord {
                path,
                change_type: "modified".into(),
                additions,
                deletions,
                note: "Derived from native git diff output.".into(),
            })
        })
        .collect::<Vec<_>>();

    Ok(BranchDiffDetailRecord {
        branch_name,
        target_branch,
        summary: if files.is_empty() {
            "No native diff was detected between the isolated lane and protected branch.".into()
        } else {
            format!("Native diff contains {} changed file(s).", files.len())
        },
        files,
    })
}

#[tauri::command]
fn evaluate_merge_readiness(
    path: String,
    branch_name: String,
    target_branch: String,
) -> Result<MergeReadinessRecord, String> {
    let repository_path = PathBuf::from(path.trim());

    if !repository_path.exists() || !repository_path.is_dir() {
        return Err("The selected repository path does not exist or is not a directory.".into());
    }

    if !has_git_marker(&repository_path) {
        return Err("The selected folder does not contain a Git repository.".into());
    }

    let mut reasons = Vec::new();

    if branch_name.trim().is_empty() || target_branch.trim().is_empty() {
        reasons.push("Both branch names are required to evaluate merge readiness.".into());
    }

    if branch_name == target_branch {
        reasons.push("An isolated lane cannot merge directly into itself.".into());
    }

    if !command_available("git") {
        reasons.push("Git CLI is unavailable in the native shell environment.".into());
    } else {
        let current_branch = git_stdout(&repository_path, &["rev-parse", "--abbrev-ref", "HEAD"]).unwrap_or_default();

        if current_branch.trim() != target_branch {
            reasons.push(format!(
                "Repository is currently on {}. Check out {} before merging.",
                if current_branch.trim().is_empty() {
                    "an unknown branch"
                } else {
                    current_branch.trim()
                },
                target_branch
            ));
        }

        let range = format!("{}..{}", target_branch, branch_name);
        let diff_output = git_stdout(&repository_path, &["diff", "--name-only", &range]).unwrap_or_default();

        if diff_output.trim().is_empty() {
            reasons.push("No diff was found between the isolated lane and protected branch.".into());
        }
    }

    let status = if reasons.is_empty() { "ready" } else { "blocked" };

    Ok(MergeReadinessRecord {
        branch_name,
        target_branch,
        status: status.into(),
        summary: if reasons.is_empty() {
            "Native merge prerequisites look coherent. Explicit operator confirmation is still required.".into()
        } else {
            reasons[0].clone()
        },
        reasons,
    })
}

#[tauri::command]
fn load_app_state(app: AppHandle) -> Result<Option<PersistedAppState>, String> {
    let connection = open_database(&app)?;
    let payload = connection
        .query_row(
            "SELECT payload_json FROM app_snapshots WHERE id = 1",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    payload
        .map(|json| serde_json::from_str::<PersistedAppState>(&json).map_err(|error| error.to_string()))
        .transpose()
}

#[tauri::command]
fn save_app_state(app: AppHandle, state: PersistedAppState) -> Result<(), String> {
    let mut connection = open_database(&app)?;
    let transaction = connection.transaction().map_err(|error| error.to_string())?;
    let now = now_timestamp();
    let payload_json = serde_json::to_string(&state).map_err(|error| error.to_string())?;

    transaction
        .execute(
            "INSERT INTO app_snapshots (id, payload_json, updated_at) VALUES (1, ?1, ?2)
             ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at",
            params![payload_json, now.clone()],
        )
        .map_err(|error| error.to_string())?;

    persist_repositories(&transaction, &state, &now)?;
    persist_swarm_draft(&transaction, &state, &now)?;
    persist_settings(&transaction, &state, &now)?;
    persist_workspace_session(&transaction, &state, &now)?;

    transaction.commit().map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            health_check,
            inspect_repository,
            inspect_git_repository,
            setup_git_isolation,
            get_branch_diff_detail,
            evaluate_merge_readiness,
            load_app_state,
            save_app_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn open_database(app: &AppHandle) -> Result<Connection, String> {
    let mut data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&data_dir).map_err(|error| error.to_string())?;
    data_dir.push("forgeswarm.sqlite3");

    let connection = Connection::open(data_dir).map_err(|error| error.to_string())?;
    initialize_database(&connection)?;
    Ok(connection)
}

fn initialize_database(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS app_snapshots (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              payload_json TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS repositories (
              id TEXT PRIMARY KEY,
              path TEXT NOT NULL UNIQUE,
              name TEXT NOT NULL,
              branch TEXT,
              validation_state TEXT NOT NULL,
              source TEXT NOT NULL,
              stack_badges_json TEXT NOT NULL,
              payload_json TEXT NOT NULL,
              last_opened_at TEXT
            );

            CREATE TABLE IF NOT EXISTS swarm_drafts (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              payload_json TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS workspace_sessions (
              id TEXT PRIMARY KEY,
              repository_path TEXT NOT NULL,
              status TEXT NOT NULL,
              active_agent_id TEXT NOT NULL,
              payload_json TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS swarms (
              id TEXT PRIMARY KEY,
              repository_path TEXT NOT NULL,
              prompt TEXT NOT NULL,
              agent_count INTEGER NOT NULL,
              status TEXT NOT NULL,
              payload_json TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS agents (
              id TEXT PRIMARY KEY,
              swarm_id TEXT NOT NULL,
              role TEXT NOT NULL,
              status TEXT NOT NULL,
              branch_name TEXT NOT NULL,
              payload_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tasks (
              id TEXT PRIMARY KEY,
              swarm_id TEXT NOT NULL,
              agent_id TEXT,
              status TEXT NOT NULL,
              payload_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS terminal_sessions (
              id TEXT PRIMARY KEY,
              agent_id TEXT NOT NULL,
              title TEXT NOT NULL,
              cwd TEXT NOT NULL,
              payload_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS diffs (
              id TEXT PRIMARY KEY,
              agent_id TEXT NOT NULL,
              title TEXT NOT NULL,
              payload_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS approvals (
              id TEXT PRIMARY KEY,
              swarm_id TEXT NOT NULL,
              branch_name TEXT NOT NULL,
              status TEXT NOT NULL,
              payload_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_settings (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              payload_json TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS check_runs (
              id TEXT PRIMARY KEY,
              swarm_id TEXT NOT NULL,
              agent_id TEXT,
              status TEXT NOT NULL,
              payload_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
              id TEXT PRIMARY KEY,
              swarm_id TEXT NOT NULL,
              agent_id TEXT,
              payload_json TEXT NOT NULL
            );
            "#,
        )
        .map_err(|error| error.to_string())
}

fn persist_repositories(
    transaction: &rusqlite::Transaction<'_>,
    state: &PersistedAppState,
    _now: &str,
) -> Result<(), String> {
    transaction
        .execute("DELETE FROM repositories", [])
        .map_err(|error| error.to_string())?;

    let mut repositories = state.recent_repositories.clone();

    if let Some(selected) = &state.selected_repository_inspection {
        if repositories
            .iter()
            .all(|repository| repository.path.to_lowercase() != selected.path.to_lowercase())
        {
            repositories.push(RecentRepositoryRecord {
                id: format!("manual:{}", selected.path),
                name: selected.name.clone(),
                path: selected.path.clone(),
                branch: selected.branch.clone(),
                validation_state: selected.validation_state.clone(),
                stack_badges: selected.stack_badges.clone(),
                last_opened_at: Some(now_timestamp()),
                source: "manual".into(),
            });
        }
    }

    for repository in repositories {
        transaction
            .execute(
                "INSERT INTO repositories (id, path, name, branch, validation_state, source, stack_badges_json, payload_json, last_opened_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    repository.id,
                    repository.path,
                    repository.name,
                    repository.branch,
                    repository.validation_state,
                    repository.source,
                    serde_json::to_string(&repository.stack_badges).map_err(|error| error.to_string())?,
                    serde_json::to_string(&repository).map_err(|error| error.to_string())?,
                    repository.last_opened_at
                ],
            )
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn persist_swarm_draft(
    transaction: &rusqlite::Transaction<'_>,
    state: &PersistedAppState,
    now: &str,
) -> Result<(), String> {
    transaction
        .execute(
            "INSERT INTO swarm_drafts (id, payload_json, updated_at) VALUES (1, ?1, ?2)
             ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at",
            params![
                serde_json::to_string(&state.swarm_draft).map_err(|error| error.to_string())?,
                now
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn persist_settings(
    transaction: &rusqlite::Transaction<'_>,
    state: &PersistedAppState,
    now: &str,
) -> Result<(), String> {
    transaction
        .execute(
            "INSERT INTO app_settings (id, payload_json, updated_at) VALUES (1, ?1, ?2)
             ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at",
            params![
                serde_json::to_string(&state.settings).map_err(|error| error.to_string())?,
                now
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn persist_workspace_session(
    transaction: &rusqlite::Transaction<'_>,
    state: &PersistedAppState,
    now: &str,
) -> Result<(), String> {
    transaction.execute("DELETE FROM workspace_sessions", []).map_err(|error| error.to_string())?;
    transaction.execute("DELETE FROM swarms", []).map_err(|error| error.to_string())?;
    transaction.execute("DELETE FROM agents", []).map_err(|error| error.to_string())?;
    transaction.execute("DELETE FROM tasks", []).map_err(|error| error.to_string())?;
    transaction.execute("DELETE FROM terminal_sessions", []).map_err(|error| error.to_string())?;
    transaction.execute("DELETE FROM diffs", []).map_err(|error| error.to_string())?;
    transaction.execute("DELETE FROM approvals", []).map_err(|error| error.to_string())?;
    transaction.execute("DELETE FROM check_runs", []).map_err(|error| error.to_string())?;
    transaction.execute("DELETE FROM messages", []).map_err(|error| error.to_string())?;

    let Some(workspace) = &state.workspace_session else {
        return Ok(());
    };

    transaction
        .execute(
            "INSERT INTO workspace_sessions (id, repository_path, status, active_agent_id, payload_json, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                workspace.id,
                workspace.repository.path,
                workspace.status,
                workspace.active_agent_id,
                serde_json::to_string(workspace).map_err(|error| error.to_string())?,
                now
            ],
        )
        .map_err(|error| error.to_string())?;

    transaction
        .execute(
            "INSERT INTO swarms (id, repository_path, prompt, agent_count, status, payload_json, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                workspace.id,
                workspace.repository.path,
                workspace.swarm_draft.prompt,
                i64::from(workspace.swarm_draft.agent_count),
                workspace.status,
                serde_json::to_string(&workspace.swarm_draft).map_err(|error| error.to_string())?,
                now
            ],
        )
        .map_err(|error| error.to_string())?;

    for agent_session in &workspace.agents {
        transaction
            .execute(
                "INSERT INTO agents (id, swarm_id, role, status, branch_name, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    agent_session.agent.id,
                    agent_session.agent.swarm_id,
                    agent_session.agent.role,
                    agent_session.agent.status,
                    agent_session.agent.branch_name,
                    serde_json::to_string(&agent_session.agent).map_err(|error| error.to_string())?
                ],
            )
            .map_err(|error| error.to_string())?;

        transaction
            .execute(
                "INSERT INTO terminal_sessions (id, agent_id, title, cwd, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    agent_session.terminal.id,
                    agent_session.terminal.agent_id,
                    agent_session.terminal.title,
                    agent_session.terminal.cwd,
                    serde_json::to_string(&agent_session.terminal).map_err(|error| error.to_string())?
                ],
            )
            .map_err(|error| error.to_string())?;

        transaction
            .execute(
                "INSERT INTO diffs (id, agent_id, title, payload_json) VALUES (?1, ?2, ?3, ?4)",
                params![
                    agent_session.diff_summary.id,
                    agent_session.diff_summary.agent_id,
                    agent_session.diff_summary.title,
                    serde_json::to_string(&agent_session.diff_summary).map_err(|error| error.to_string())?
                ],
            )
            .map_err(|error| error.to_string())?;

        transaction
            .execute(
                "INSERT INTO approvals (id, swarm_id, branch_name, status, payload_json)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    agent_session
                        .approval
                        .as_ref()
                        .map(|approval| approval.id.clone())
                        .unwrap_or_else(|| format!("approval:{}", agent_session.agent.id)),
                    agent_session.agent.swarm_id,
                    agent_session.agent.branch_name,
                    agent_session
                        .approval
                        .as_ref()
                        .map(|approval| approval.status.clone())
                        .unwrap_or_else(|| "pending".into()),
                    serde_json::to_string(
                        &agent_session.approval.as_ref().cloned().unwrap_or(ApprovalRecord {
                            id: format!("approval:{}", agent_session.agent.id),
                            swarm_id: agent_session.agent.swarm_id.clone(),
                            agent_id: agent_session.agent.id.clone(),
                            branch_name: agent_session.agent.branch_name.clone(),
                            status: "pending".into(),
                            requested_by_agent_id: agent_session.agent.id.clone(),
                            requested_at: now_timestamp(),
                            decided_at: None,
                            decided_by: None,
                            summary: format!(
                                "Awaiting explicit merge approval for {}",
                                agent_session.agent.branch_name
                            ),
                            comment: None,
                            audit_trail: Vec::new()
                        })
                    )
                    .map_err(|error| error.to_string())?
                ],
            )
            .map_err(|error| error.to_string())?;

        for task in &agent_session.tasks {
            transaction
                .execute(
                    "INSERT INTO tasks (id, swarm_id, agent_id, status, payload_json)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        task.id,
                        task.swarm_id,
                        task.agent_id,
                        task.status,
                        serde_json::to_string(task).map_err(|error| error.to_string())?
                    ],
                )
                .map_err(|error| error.to_string())?;
        }

        for check in &agent_session.checks {
            transaction
                .execute(
                    "INSERT INTO check_runs (id, swarm_id, agent_id, status, payload_json)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        check.id,
                        check.swarm_id,
                        check.agent_id,
                        check.status,
                        serde_json::to_string(check).map_err(|error| error.to_string())?
                    ],
                )
                .map_err(|error| error.to_string())?;
        }

        for comment in &agent_session.comments {
            transaction
                .execute(
                    "INSERT INTO messages (id, swarm_id, agent_id, payload_json) VALUES (?1, ?2, ?3, ?4)",
                    params![
                        comment.id,
                        agent_session.agent.swarm_id,
                        agent_session.agent.id,
                        serde_json::to_string(comment).map_err(|error| error.to_string())?
                    ],
                )
                .map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

fn has_git_marker(path: &Path) -> bool {
    path.join(".git").exists()
}

fn detect_branch(path: &Path) -> Option<String> {
    let git_entry = path.join(".git");
    let head_path = if git_entry.is_file() {
        fs::read_to_string(&git_entry)
            .ok()
            .and_then(|contents| contents.strip_prefix("gitdir: ").map(str::trim).map(PathBuf::from))
            .map(|gitdir| gitdir.join("HEAD"))?
    } else {
        git_entry.join("HEAD")
    };

    let head_contents = fs::read_to_string(head_path).ok()?;
    let head = head_contents.trim();

    if let Some(reference) = head.strip_prefix("ref: refs/heads/") {
        return Some(reference.to_string());
    }

    if head.is_empty() {
        None
    } else {
        Some("detached".into())
    }
}

fn detect_stack(path: &Path) -> (Vec<StackBadge>, Vec<String>) {
    let mut badges = Vec::new();
    let mut detected_files = Vec::new();

    let push_badge = |badges: &mut Vec<StackBadge>, label: &str, confidence: &str| {
        if !badges.iter().any(|badge| badge.label.eq_ignore_ascii_case(label)) {
            badges.push(StackBadge {
                label: label.to_string(),
                confidence: confidence.to_string(),
            });
        }
    };

    if path.join("package.json").exists() {
        detected_files.push("package.json".into());
        push_badge(&mut badges, "Node.js", "detected");

        if let Ok(contents) = fs::read_to_string(path.join("package.json")) {
            if let Ok(json) = serde_json::from_str::<Value>(&contents) {
                let dependencies = json
                    .get("dependencies")
                    .and_then(Value::as_object)
                    .into_iter()
                    .flatten()
                    .chain(
                        json.get("devDependencies")
                            .and_then(Value::as_object)
                            .into_iter()
                            .flatten(),
                    );

                for (name, _) in dependencies {
                    match name.as_str() {
                        "react" => push_badge(&mut badges, "React", "detected"),
                        "next" => push_badge(&mut badges, "Next.js", "detected"),
                        "vite" => push_badge(&mut badges, "Vite", "detected"),
                        "@tauri-apps/api" => push_badge(&mut badges, "Tauri v2", "detected"),
                        "typescript" => push_badge(&mut badges, "TypeScript", "detected"),
                        "tailwindcss" => push_badge(&mut badges, "Tailwind CSS", "detected"),
                        _ => {}
                    }
                }
            }
        }
    }

    let checks = [
        ("pnpm-lock.yaml", "pnpm"),
        ("Cargo.toml", "Rust"),
        ("pyproject.toml", "Python"),
        ("requirements.txt", "Python"),
        ("go.mod", "Go"),
        ("tsconfig.json", "TypeScript"),
    ];

    for (file, label) in checks {
        if path.join(file).exists() {
            detected_files.push(file.into());
            push_badge(&mut badges, label, "detected");
        }
    }

    (badges, detected_files)
}

fn command_available(binary: &str) -> bool {
    Command::new(binary)
        .arg("--version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn git_stdout(path: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
        .output()
        .map_err(|error| error.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

fn ensure_branch_exists(path: &Path, branch_name: &str, base_branch: &str) -> Result<(), String> {
    let existing = git_stdout(path, &["branch", "--list", branch_name]).unwrap_or_default();

    if !existing.trim().is_empty() {
        return Ok(());
    }

    let base_reference = if branch_name == base_branch {
        "HEAD"
    } else {
        base_branch
    };

    git_stdout(path, &["branch", branch_name, base_reference]).map(|_| ())
}

fn ensure_worktree_exists(path: &Path, worktree_path: &str, branch_name: &str) -> Result<String, String> {
    let worktree = PathBuf::from(worktree_path);

    if worktree.exists() {
        return Ok("Existing worktree reused for this lane.".into());
    }

    if let Some(parent) = worktree.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    git_stdout(
        path,
        &["worktree", "add", worktree.to_string_lossy().as_ref(), branch_name],
    )
    .map(|_| format!("Created isolated worktree at {}", worktree.to_string_lossy()))
}

fn mark_plan_unavailable(mut plan: GitIsolationPlanRecord, error: &str) -> GitIsolationPlanRecord {
    plan.status = "warning".into();
    plan.warnings = dedupe_lines(plan.warnings.into_iter().chain([error.into()]).collect());
    plan.workspaces = plan
        .workspaces
        .into_iter()
        .map(|mut workspace| {
            workspace.status = "warning".into();
            workspace.note = error.into();
            workspace.exists = false;
            workspace.last_synced_at = Some(now_iso());
            workspace
        })
        .collect();
    plan
}

fn dedupe_lines(items: Vec<String>) -> Vec<String> {
    let mut unique = Vec::new();

    for item in items {
        if !item.is_empty() && !unique.iter().any(|existing| existing == &item) {
            unique.push(item);
        }
    }

    unique
}

fn now_iso() -> String {
    now_timestamp()
}

fn now_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".into())
}
