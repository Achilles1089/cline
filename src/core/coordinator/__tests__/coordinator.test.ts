import { beforeEach, describe, it } from "mocha"
import "should"
import type { ApiHandler, ApiHandlerModel } from "@core/api"
import type { ApiStream, ApiStreamUsageChunk } from "@core/api/transform/stream"
import type { ApiConfiguration } from "@/shared/api"
import type { ClineStorageMessage } from "@/shared/messages/content"
import type { ClineTool } from "@/shared/tools"
import { CoordinatedApiHandler } from "../coordinator"
import { type CoordinatorSettings, DEFAULT_COORDINATOR_SETTINGS, TaskRole } from "../types"

/**
 * Creates a mock ApiHandler that yields a single text chunk.
 * Used to verify routing — each specialist returns its own identifier.
 */
function createMockHandler(id: string): ApiHandler {
	return {
		async *createMessage(_systemPrompt: string, _messages: ClineStorageMessage[], _tools?: ClineTool[]): ApiStream {
			yield { type: "text" as const, text: `response-from-${id}` }
		},
		getModel(): ApiHandlerModel {
			// biome-ignore lint/suspicious/noExplicitAny: mock model info
			return { id, info: {} as any }
		},
		async getApiStreamUsage(): Promise<ApiStreamUsageChunk | undefined> {
			return undefined
		},
		abort() {},
	}
}

/** Collect all text chunks from an ApiStream */
async function collectStream(stream: ApiStream): Promise<string[]> {
	const results: string[] = []
	for await (const chunk of stream) {
		if (chunk.type === "text") {
			results.push(chunk.text)
		}
	}
	return results
}

describe("CoordinatedApiHandler", () => {
	let primaryHandler: ApiHandler
	let settings: CoordinatorSettings
	// biome-ignore lint/suspicious/noExplicitAny: mock API config
	const mockApiConfig: ApiConfiguration = {} as any
	const mockMode = "act" as const

	beforeEach(() => {
		primaryHandler = createMockHandler("primary")
		settings = {
			...DEFAULT_COORDINATOR_SETTINGS,
			enabled: true,
		}
	})

	describe("When Disabled", () => {
		it("should pass through to primary handler when coordinator is disabled", async () => {
			const disabledSettings = { ...settings, enabled: false }
			const coordinator = new CoordinatedApiHandler(primaryHandler, disabledSettings, mockApiConfig, mockMode)

			const results = await collectStream(coordinator.createMessage("test prompt", []))
			results.should.deepEqual(["response-from-primary"])
			coordinator.lastActiveRole.should.equal(TaskRole.Primary)
		})
	})

	describe("When Enabled — No Overrides", () => {
		it("should use Primary when no role overrides are configured", async () => {
			const coordinator = new CoordinatedApiHandler(primaryHandler, settings, mockApiConfig, mockMode)

			// Set context that would match Designer
			coordinator.setClassificationContext({ activeFiles: ["styles.css"] })

			const results = await collectStream(coordinator.createMessage("test prompt", []))
			// No Designer override configured → falls back to Primary
			results.should.deepEqual(["response-from-primary"])
			coordinator.lastActiveRole.should.equal(TaskRole.Primary)
		})
	})

	describe("Classification Context", () => {
		it("should set and use classification context", async () => {
			const coordinator = new CoordinatedApiHandler(primaryHandler, settings, mockApiConfig, mockMode)
			coordinator.setClassificationContext({ latestUserMessage: "fix the login function" })

			const results = await collectStream(coordinator.createMessage("test prompt", []))
			results.should.deepEqual(["response-from-primary"])
		})

		it("should report Primary as last active role when no specialist matches", async () => {
			const coordinator = new CoordinatedApiHandler(primaryHandler, settings, mockApiConfig, mockMode)
			coordinator.setClassificationContext({})

			await collectStream(coordinator.createMessage("test prompt", []))
			coordinator.lastActiveRole.should.equal(TaskRole.Primary)
		})
	})

	describe("Handler Management", () => {
		it("should return primary model info by default", () => {
			const coordinator = new CoordinatedApiHandler(primaryHandler, settings, mockApiConfig, mockMode)
			coordinator.getModel().id.should.equal("primary")
		})

		it("should update primary handler", async () => {
			const coordinator = new CoordinatedApiHandler(primaryHandler, settings, mockApiConfig, mockMode)
			const newPrimary = createMockHandler("new-primary")
			coordinator.updatePrimaryHandler(newPrimary)

			const results = await collectStream(coordinator.createMessage("test", []))
			results.should.deepEqual(["response-from-new-primary"])
		})

		it("should update settings and clear cached handlers", () => {
			const coordinator = new CoordinatedApiHandler(primaryHandler, settings, mockApiConfig, mockMode)
			const newSettings = { ...settings, enabled: false }
			coordinator.updateSettings(newSettings)

			// After disabling, should pass through to primary
			coordinator.lastActiveRole.should.equal(TaskRole.Primary)
		})
	})

	describe("Abort", () => {
		it("should call abort on primary handler", () => {
			let abortCalled = false
			const handler = createMockHandler("primary")
			handler.abort = () => {
				abortCalled = true
			}

			const coordinator = new CoordinatedApiHandler(handler, settings, mockApiConfig, mockMode)
			coordinator.abort()
			abortCalled.should.be.true()
		})
	})

	describe("Stream Usage", () => {
		it("should proxy getApiStreamUsage to primary handler", async () => {
			const handler = createMockHandler("primary")
			handler.getApiStreamUsage = async () =>
				({
					inputTokens: 100,
					outputTokens: 50,
					// biome-ignore lint/suspicious/noExplicitAny: mock stream usage
				}) as any

			const coordinator = new CoordinatedApiHandler(handler, settings, mockApiConfig, mockMode)
			const usage = await coordinator.getApiStreamUsage()
			// biome-ignore lint/suspicious/noExplicitAny: accessing mock usage
			;(usage as any).inputTokens.should.equal(100)
		})
	})
})
