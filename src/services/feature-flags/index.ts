/**
 * Dappit AI — Feature Flags Service (No-Op Stub)
 *
 * Cline feature flags (PostHog-backed) are not used in Dappit.
 * All feature flags return their default values.
 */
export {
	type FeatureFlagsProviderConfig,
	FeatureFlagsProviderFactory,
	type FeatureFlagsProviderType,
} from "./FeatureFlagsProviderFactory"
export { FeatureFlagsService } from "./FeatureFlagsService"
export type { FeatureFlagsSettings, IFeatureFlagsProvider } from "./providers/IFeatureFlagsProvider"
export { PostHogFeatureFlagsProvider } from "./providers/PostHogFeatureFlagsProvider"

import { FeatureFlagsService } from "./FeatureFlagsService"

let _featureFlagsServiceInstance: FeatureFlagsService | null = null

// No-op feature flag provider that always returns defaults
const noOpProvider = {
	initialize: async () => { },
	getFeatureFlag: (_flag: string) => undefined,
	isFeatureEnabled: (_flag: string) => false,
	getAllFlags: () => ({}),
	shutdown: async () => { },
}

export function getFeatureFlagsService(): FeatureFlagsService {
	if (!_featureFlagsServiceInstance) {
		_featureFlagsServiceInstance = new FeatureFlagsService(noOpProvider as any)
	}
	return _featureFlagsServiceInstance
}

export function resetFeatureFlagsService(): void {
	_featureFlagsServiceInstance = null
}

export const featureFlagsService = new Proxy({} as FeatureFlagsService, {
	get(_target, prop, _receiver) {
		const service = getFeatureFlagsService()
		const value = Reflect.get(service, prop, service)
		if (typeof value === "function") {
			return value.bind(service)
		}
		return value
	},
})
