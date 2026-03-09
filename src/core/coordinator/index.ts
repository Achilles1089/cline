/**
 * Multi-Model Coordinator — Barrel Export
 *
 * The coordinator routes API requests to specialist models based on
 * task classification. Import from @core/coordinator for all coordinator types.
 */

export { type ClassificationContext, classifyTask } from "./classifier"
export { CoordinatedApiHandler, createCoordinatedHandler } from "./coordinator"
export { getRoleLabel, getRoleOverlay } from "./role-prompts"
export {
	type ClassificationResult,
	type CoordinatorSettings,
	DEFAULT_COORDINATOR_SETTINGS,
	type RoleAssignments,
	type RoleConfig,
	TaskRole,
} from "./types"
