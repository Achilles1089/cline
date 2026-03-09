import { describe, it } from "mocha"
import "should"
import { classifyTask } from "../classifier"
import { TaskRole } from "../types"

describe("Task Classifier", () => {
	describe("File Extension Classification", () => {
		it("should classify .css files as Designer", () => {
			const result = classifyTask({ activeFiles: ["styles/main.css"] })
			result.role.should.equal(TaskRole.Designer)
			result.confidence.should.equal("high")
		})

		it("should classify .scss files as Designer", () => {
			const result = classifyTask({ activeFiles: ["theme.scss"] })
			result.role.should.equal(TaskRole.Designer)
		})

		it("should classify .sol files as Web3Developer", () => {
			const result = classifyTask({ activeFiles: ["contracts/Token.sol"] })
			result.role.should.equal(TaskRole.Web3Developer)
			result.confidence.should.equal("high")
		})

		it("should classify .rs files as Web3Developer", () => {
			const result = classifyTask({ activeFiles: ["programs/anchor/lib.rs"] })
			result.role.should.equal(TaskRole.Web3Developer)
		})

		it("should classify .md files as DocumentWriter", () => {
			const result = classifyTask({ activeFiles: ["README.md"] })
			result.role.should.equal(TaskRole.DocumentWriter)
		})

		it("should classify .json files as FastEdits", () => {
			const result = classifyTask({ activeFiles: ["package.json"] })
			result.role.should.equal(TaskRole.FastEdits)
		})

		it("should classify .yaml files as FastEdits", () => {
			const result = classifyTask({ activeFiles: ["docker-compose.yml"] })
			result.role.should.equal(TaskRole.FastEdits)
		})

		it("should classify .env files as FastEdits", () => {
			const result = classifyTask({ activeFiles: [".env"] })
			result.role.should.equal(TaskRole.FastEdits)
		})

		it("should use the first file's classification when multiple files present", () => {
			const result = classifyTask({ activeFiles: ["Token.sol", "styles.css"] })
			result.role.should.equal(TaskRole.Web3Developer)
		})

		it("should return Primary for unknown extensions", () => {
			const result = classifyTask({ activeFiles: ["main.py"] })
			result.role.should.equal(TaskRole.Primary)
		})
	})

	describe("Tool Name Classification", () => {
		it("should classify diagnostics tool as ErrorChecker", () => {
			const result = classifyTask({ pendingToolName: "diagnostics" })
			result.role.should.equal(TaskRole.ErrorChecker)
		})

		it("should classify browser tool as Designer", () => {
			const result = classifyTask({ pendingToolName: "browser_action" })
			result.role.should.equal(TaskRole.Designer)
		})

		it("should return Primary for unknown tool names", () => {
			const result = classifyTask({ pendingToolName: "write_to_file" })
			result.role.should.equal(TaskRole.Primary)
		})
	})

	describe("Content Pattern Classification", () => {
		it("should detect Web3 keywords with high confidence", () => {
			const result = classifyTask({ latestUserMessage: "Write a Solidity smart contract for an ERC-20 token" })
			result.role.should.equal(TaskRole.Web3Developer)
			result.confidence.should.equal("high")
		})

		it("should detect design keywords", () => {
			const result = classifyTask({ latestUserMessage: "Fix the CSS layout and make the font larger" })
			result.role.should.equal(TaskRole.Designer)
		})

		it("should detect audit keywords", () => {
			const result = classifyTask({ latestUserMessage: "Review this code for security vulnerabilities" })
			result.role.should.equal(TaskRole.Auditor)
		})

		it("should detect documentation keywords", () => {
			const result = classifyTask({ latestUserMessage: "Write the API docs and update the README" })
			result.role.should.equal(TaskRole.DocumentWriter)
		})

		it("should detect video keywords", () => {
			const result = classifyTask({ latestUserMessage: "Create a Remotion video explaining the feature" })
			result.role.should.equal(TaskRole.VideoCreator)
		})

		it("should return Primary when no patterns match", () => {
			const result = classifyTask({ latestUserMessage: "Implement the login function" })
			result.role.should.equal(TaskRole.Primary)
		})
	})

	describe("Priority Order", () => {
		it("should prefer file extension over content patterns", () => {
			const result = classifyTask({
				activeFiles: ["Token.sol"],
				latestUserMessage: "Fix the CSS layout",
			})
			result.role.should.equal(TaskRole.Web3Developer)
		})

		it("should prefer tool name over content patterns", () => {
			const result = classifyTask({
				pendingToolName: "diagnostics",
				latestUserMessage: "Make the design look better",
			})
			result.role.should.equal(TaskRole.ErrorChecker)
		})

		it("should prefer file extension over tool name", () => {
			const result = classifyTask({
				activeFiles: ["styles.css"],
				pendingToolName: "diagnostics",
			})
			result.role.should.equal(TaskRole.Designer)
		})
	})

	describe("Edge Cases", () => {
		it("should handle empty context", () => {
			const result = classifyTask({})
			result.role.should.equal(TaskRole.Primary)
			result.confidence.should.equal("high")
		})

		it("should handle empty file array", () => {
			const result = classifyTask({ activeFiles: [] })
			result.role.should.equal(TaskRole.Primary)
		})

		it("should handle empty strings", () => {
			const result = classifyTask({ latestUserMessage: "" })
			result.role.should.equal(TaskRole.Primary)
		})

		it("should handle file paths without extensions", () => {
			const result = classifyTask({ activeFiles: ["Dockerfile"] })
			result.role.should.equal(TaskRole.Primary)
		})
	})
})
