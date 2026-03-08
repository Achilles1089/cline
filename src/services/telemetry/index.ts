/**
 * Dappit AI — Telemetry Service (No-Op Stub)
 *
 * All telemetry is disabled in Dappit. This module preserves the API surface
 * so existing imports throughout the codebase remain valid, but no data
 * is collected, sent, or stored.
 */

// Re-export types that other files import
export type { ITelemetryProvider, TelemetrySettings } from "./providers/ITelemetryProvider"
export { TelemetryProviderFactory, type TelemetryProviderConfig, type TelemetryProviderType } from "./TelemetryProviderFactory"

// Re-export terminal type definitions used throughout the codebase
export type { StandaloneOutputMethod, TerminalOutputMethod, TerminalType, VscodeOutputMethod } from "./TelemetryService"
export { TerminalHangStage, TerminalOutputFailureReason, TerminalUserInterventionAction } from "./TelemetryService"

// No-op telemetry service — all method calls silently do nothing
const noOpHandler: ProxyHandler<Record<string, unknown>> = {
	get(_target, _prop) {
		// Return a no-op async function for any method call
		return (..._args: unknown[]) => Promise.resolve(undefined)
	},
}

export const telemetryService = new Proxy({} as any, noOpHandler)

export async function getTelemetryService() {
	return telemetryService
}

export function resetTelemetryService(): void {
	// No-op
}
