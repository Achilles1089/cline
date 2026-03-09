/**
 * Multi-Model Coordinator — Core Routing Logic
 *
 * Wraps the standard ApiHandler and intercepts createMessage() to route
 * requests to specialist models based on task classification.
 *
 * When no specialist is configured, it passes through to the Primary handler
 * with zero overhead — Dappit behaves identically to stock Cline.
 */

import type { ApiHandler, ApiHandlerModel } from "@core/api"
import { buildApiHandler } from "@core/api"
import type { ApiStream, ApiStreamUsageChunk } from "@core/api/transform/stream"
import type { ApiConfiguration, ApiProvider } from "@/shared/api"
import type { ClineStorageMessage } from "@/shared/messages/content"
import { Logger } from "@/shared/services/Logger"
import type { Mode } from "@/shared/storage/types"
import type { ClineTool } from "@/shared/tools"

import { type ClassificationContext, classifyTask } from "./classifier"
import { getRoleOverlay } from "./role-prompts"
import { type CoordinatorSettings, DEFAULT_COORDINATOR_SETTINGS, type RoleConfig, TaskRole } from "./types"

/**
 * CoordinatedApiHandler wraps a primary ApiHandler and selectively
 * routes requests to specialist handlers based on task classification.
 *
 * It implements the same ApiHandler interface, so it's a drop-in replacement.
 */
export class CoordinatedApiHandler implements ApiHandler {
	private primaryHandler: ApiHandler
	private settings: CoordinatorSettings
	private apiConfiguration: ApiConfiguration
	private mode: Mode

	/** Cache of specialist handlers — built lazily, reused across requests */
	private specialistHandlers: Map<TaskRole, ApiHandler> = new Map()

	/** The role used for the most recent request (for status bar display) */
	private _lastActiveRole: TaskRole = TaskRole.Primary

	/** Classification context — set externally before each createMessage call */
	private _classificationContext: ClassificationContext = {}

	constructor(primaryHandler: ApiHandler, settings: CoordinatorSettings, apiConfiguration: ApiConfiguration, mode: Mode) {
		this.primaryHandler = primaryHandler
		this.settings = settings
		this.apiConfiguration = apiConfiguration
		this.mode = mode
	}

	/**
	 * Set the classification context for the upcoming request.
	 * Called by Task before each API request with current file/tool context.
	 */
	setClassificationContext(context: ClassificationContext): void {
		this._classificationContext = context
	}

	/**
	 * Get the role used for the most recent request.
	 * Used by status bar indicator and analytics.
	 */
	get lastActiveRole(): TaskRole {
		return this._lastActiveRole
	}

	/**
	 * Update coordinator settings (e.g., when user changes role assignments).
	 */
	updateSettings(settings: CoordinatorSettings): void {
		this.settings = settings
		// Invalidate cached specialist handlers — they may have changed
		this.specialistHandlers.clear()
	}

	/**
	 * Update the primary handler (e.g., when Plan/Act mode changes).
	 */
	updatePrimaryHandler(handler: ApiHandler): void {
		this.primaryHandler = handler
	}

	/**
	 * Update the mode (Plan/Act) and invalidate cached specialist handlers.
	 * Called when the user switches between Plan and Act mode.
	 */
	updateMode(mode: Mode): void {
		if (this.mode !== mode) {
			this.mode = mode
			// Specialist handlers are mode-specific — clear the cache
			this.specialistHandlers.clear()
		}
	}

	/**
	 * Core routing method — intercepts createMessage and routes to specialist.
	 */
	async *createMessage(
		systemPrompt: string,
		messages: ClineStorageMessage[],
		tools?: ClineTool[],
		useResponseApi?: boolean,
	): ApiStream {
		// If coordinator is disabled, pass through directly
		if (!this.settings.enabled) {
			this._lastActiveRole = TaskRole.Primary
			yield* this.primaryHandler.createMessage(systemPrompt, messages, tools, useResponseApi)
			return
		}

		// Classify the task
		const classification = classifyTask(this._classificationContext)
		const role = classification.role

		// Check if this role has a specialist override
		const roleConfig = this.settings.roleAssignments[role]
		if (!roleConfig || !roleConfig.enabled || role === TaskRole.Primary) {
			// No specialist configured — use Primary
			this._lastActiveRole = TaskRole.Primary
			Logger.info(`[Coordinator] Using Primary model (${classification.reason})`)
			yield* this.primaryHandler.createMessage(systemPrompt, messages, tools, useResponseApi)
			return
		}

		// Get or build the specialist handler
		const specialistHandler = this.getOrBuildSpecialistHandler(role, roleConfig)
		if (!specialistHandler) {
			// Failed to build specialist — fall back to Primary
			this._lastActiveRole = TaskRole.Primary
			Logger.warn(`[Coordinator] Failed to build specialist for ${role}, falling back to Primary`)
			yield* this.primaryHandler.createMessage(systemPrompt, messages, tools, useResponseApi)
			return
		}

		// Append role overlay to system prompt
		const overlay = getRoleOverlay(role, roleConfig.customSystemPrompt)
		const enhancedPrompt = overlay ? systemPrompt + overlay : systemPrompt

		this._lastActiveRole = role
		Logger.info(`[Coordinator] Routing to ${role} specialist (${classification.reason})`)

		// Delegate to specialist handler
		yield* specialistHandler.createMessage(enhancedPrompt, messages, tools, useResponseApi)
	}

	/**
	 * Returns the model info for the currently active handler.
	 * If a specialist was used in the last request, returns its model.
	 */
	getModel(): ApiHandlerModel {
		if (this._lastActiveRole !== TaskRole.Primary) {
			const specialist = this.specialistHandlers.get(this._lastActiveRole)
			if (specialist) {
				return specialist.getModel()
			}
		}
		return this.primaryHandler.getModel()
	}

	/**
	 * Proxy to the active handler's stream usage.
	 * Routes to the specialist handler if one was used for the last request.
	 */
	async getApiStreamUsage(): Promise<ApiStreamUsageChunk | undefined> {
		if (this._lastActiveRole !== TaskRole.Primary) {
			const specialist = this.specialistHandlers.get(this._lastActiveRole)
			if (specialist?.getApiStreamUsage) {
				return specialist.getApiStreamUsage()
			}
		}
		return this.primaryHandler.getApiStreamUsage?.()
	}

	/**
	 * Abort all active requests — both primary and any active specialist.
	 */
	abort(): void {
		this.primaryHandler.abort?.()
		for (const handler of this.specialistHandlers.values()) {
			handler.abort?.()
		}
	}

	/**
	 * Build a specialist handler for the given role, or return cached one.
	 */
	private getOrBuildSpecialistHandler(role: TaskRole, config: RoleConfig): ApiHandler | undefined {
		// Return cached handler if available
		const cached = this.specialistHandlers.get(role)
		if (cached) {
			return cached
		}

		try {
			// Build a new configuration with the specialist's provider/model
			const specialistConfig: ApiConfiguration = {
				...this.apiConfiguration,
			}

			// Override the provider for the current mode
			if (config.apiProvider) {
				const provider = config.apiProvider as ApiProvider
				if (this.mode === "plan") {
					specialistConfig.planModeApiProvider = provider
				} else {
					specialistConfig.actModeApiProvider = provider
				}
			}

			// Override the model ID if specified
			if (config.modelId) {
				if (this.mode === "plan") {
					specialistConfig.planModeApiModelId = config.modelId
				} else {
					specialistConfig.actModeApiModelId = config.modelId
				}
			}

			const handler = buildApiHandler(specialistConfig, this.mode)
			this.specialistHandlers.set(role, handler)

			Logger.info(`[Coordinator] Built specialist handler for ${role}: ${config.apiProvider}/${config.modelId}`)
			return handler
		} catch (error) {
			Logger.error(`[Coordinator] Failed to build specialist handler for ${role}:`, error)
			return undefined
		}
	}

	/**
	 * Clear all cached specialist handlers.
	 * Called when settings or configuration changes.
	 */
	dispose(): void {
		this.specialistHandlers.clear()
	}
}

/**
 * Create a coordinator-wrapped API handler.
 * If coordinator is disabled in settings, returns the primary handler unwrapped.
 */
export function createCoordinatedHandler(
	primaryHandler: ApiHandler,
	settings: CoordinatorSettings | undefined,
	apiConfiguration: ApiConfiguration,
	mode: Mode,
): ApiHandler | CoordinatedApiHandler {
	const effectiveSettings = settings ?? DEFAULT_COORDINATOR_SETTINGS

	if (!effectiveSettings.enabled) {
		// Coordinator disabled — return bare handler (zero overhead)
		return primaryHandler
	}

	return new CoordinatedApiHandler(primaryHandler, effectiveSettings, apiConfiguration, mode)
}
