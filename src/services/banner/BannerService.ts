/**
 * Dappit AI — Banner Service (No-Op Stub)
 *
 * Cline promotional banners are not used in Dappit.
 * This stub preserves the API surface for import compatibility.
 */
import type { BannerCardData } from "@shared/cline/banner"
import type { Controller } from "@/core/controller"

export class BannerService {
	private static instance: BannerService | null = null

	private constructor(
		private readonly _controller: Controller,
	) { }

	public static initialize(controller: Controller): BannerService {
		if (!BannerService.instance) {
			BannerService.instance = new BannerService(controller)
		}
		return BannerService.instance
	}

	public static get(): BannerService {
		if (!BannerService.instance) {
			throw new Error("BannerService not initialized.")
		}
		return BannerService.instance
	}

	public static reset(): void {
		BannerService.instance = null
	}

	public static tryGet(): BannerService | null {
		return BannerService.instance
	}

	public async onAuthUpdate(_userId: string | null): Promise<void> {
		// No-op
	}

	public getActiveBanners(): BannerCardData[] {
		return [] // No banners in Dappit
	}

	public getWelcomeBanners(): BannerCardData[] | undefined {
		return undefined
	}

	public async dismissBanner(_bannerId: string): Promise<void> {
		// No-op
	}

	public async sendBannerEvent(_bannerId: string, _eventType: "dismiss"): Promise<void> {
		// No-op
	}
}
