/**
 * Multi-Model Coordinator — Type Definitions
 *
 * Defines the role-based routing types for the Dappit coordinator.
 * The coordinator routes API requests to specialist models based on
 * detected task type, without extra LLM calls.
 */

/**
 * Specialist roles that can be assigned to different models.
 * Each role represents a task category the agent handles.
 */
export enum TaskRole {
	/** Default model — handles everything when no specialist is assigned */
	Primary = "primary",
	/** UI/UX design, CSS, layout, color choices */
	Designer = "designer",
	/** Core logic, algorithms, refactoring, debugging */
	Coder = "coder",
	/** Architecture planning, task decomposition */
	Planner = "planner",
	/** Linting, error diagnosis, test failures */
	ErrorChecker = "error_checker",
	/** Quick edits, typos, small config changes */
	FastEdits = "fast_edits",
	/** README, docs, comments, changelogs */
	DocumentWriter = "document_writer",
	/** Video scripts, Remotion compositions */
	VideoCreator = "video_creator",
	/** Code review, security audit, best practices */
	Auditor = "auditor",
	/** Solidity, Anchor, smart contracts, Web3 */
	Web3Developer = "web3_developer",
	/** Image generation prompts, asset creation */
	Images = "images",
}

/**
 * Configuration for a single specialist role.
 * When enabled, requests classified as this role will use
 * the specified provider/model instead of the Primary.
 */
export interface RoleConfig {
	/** Whether this role override is active */
	enabled: boolean
	/** API provider to use for this role (e.g., "anthropic", "openai", "gemini") */
	apiProvider?: string
	/** Specific model ID (e.g., "claude-sonnet-4-20250514", "gemini-2.5-pro") */
	modelId?: string
	/** Optional custom system prompt overlay for this role */
	customPromptOverlay?: string
}

/**
 * Complete role assignment map — stored in settings.
 * Maps each TaskRole to its specialist configuration.
 * Roles without entries (or with enabled: false) fall back to Primary.
 */
export type RoleAssignments = Partial<Record<TaskRole, RoleConfig>>

/**
 * Result of task classification — what role should handle this request.
 */
export interface ClassificationResult {
	/** The detected role for the current task */
	role: TaskRole
	/** Confidence level of the classification (for logging/analytics) */
	confidence: "high" | "medium" | "low"
	/** Human-readable reason for the classification */
	reason: string
}

/**
 * Settings shape for the coordinator, stored via StateManager.
 */
export interface CoordinatorSettings {
	/** Whether the coordinator is enabled at all */
	enabled: boolean
	/** Per-role configurations */
	roleAssignments: RoleAssignments
	/** Show the active role in the status bar */
	showStatusBarIndicator: boolean
}

/**
 * Default coordinator settings — coordinator disabled, no role overrides.
 * This ensures the IDE behaves exactly like stock Cline when the user
 * hasn't configured any specialist roles.
 */
export const DEFAULT_COORDINATOR_SETTINGS: CoordinatorSettings = {
	enabled: false,
	roleAssignments: {},
	showStatusBarIndicator: true,
}
