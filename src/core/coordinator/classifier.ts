/**
 * Multi-Model Coordinator — Task Classifier
 *
 * Classifies the current task into a TaskRole based on:
 *  1. Tool calls the agent is about to make
 *  2. File extensions being edited
 *  3. Content patterns in the conversation
 *
 * Zero extra LLM calls — classification is deterministic from context.
 */

import { type ClassificationResult, TaskRole } from "./types"

/** File extension → role mapping */
const EXTENSION_ROLE_MAP: Record<string, TaskRole> = {
	// Designer
	".css": TaskRole.Designer,
	".scss": TaskRole.Designer,
	".sass": TaskRole.Designer,
	".less": TaskRole.Designer,
	".styled.ts": TaskRole.Designer,
	".styled.tsx": TaskRole.Designer,
	".module.css": TaskRole.Designer,

	// Web3 Developer
	".sol": TaskRole.Web3Developer,
	".vy": TaskRole.Web3Developer,
	".rs": TaskRole.Web3Developer, // Anchor/Solana programs
	".move": TaskRole.Web3Developer,

	// Document Writer
	".md": TaskRole.DocumentWriter,
	".mdx": TaskRole.DocumentWriter,
	".rst": TaskRole.DocumentWriter,
	".txt": TaskRole.DocumentWriter,

	// Config / Fast Edits
	".json": TaskRole.FastEdits,
	".yaml": TaskRole.FastEdits,
	".yml": TaskRole.FastEdits,
	".toml": TaskRole.FastEdits,
	".env": TaskRole.FastEdits,
	".gitignore": TaskRole.FastEdits,
}

/** Tool name patterns → role mapping */
const TOOL_ROLE_MAP: Record<string, TaskRole> = {
	// Error checking tools
	diagnostics: TaskRole.ErrorChecker,
	lint: TaskRole.ErrorChecker,
	test: TaskRole.ErrorChecker,

	// Browser / visual tools → Designer
	browser: TaskRole.Designer,
	screenshot: TaskRole.Designer,

	// File reading is neutral — doesn't trigger a role
}

/** Content pattern keywords → role mapping (checked against user message) */
const CONTENT_PATTERNS: Array<{ pattern: RegExp; role: TaskRole; confidence: "high" | "medium" }> = [
	// Designer patterns
	{
		pattern: /\b(design|layout|css|style|color|font|responsive|ui|ux|tailwind|animation)\b/i,
		role: TaskRole.Designer,
		confidence: "medium",
	},

	// Web3 patterns
	{
		pattern: /\b(solidity|smart contract|erc-?20|erc-?721|hardhat|foundry|anchor|solana|web3|ethers|wagmi|pump\.fun|ipfs)\b/i,
		role: TaskRole.Web3Developer,
		confidence: "high",
	},

	// Auditor patterns
	{
		pattern: /\b(audit|review|security|vulnerability|best practice|code review|penetration)\b/i,
		role: TaskRole.Auditor,
		confidence: "medium",
	},

	// Document Writer patterns
	{
		pattern: /\b(documentation|readme|changelog|write docs|api docs|jsdoc|tsdoc)\b/i,
		role: TaskRole.DocumentWriter,
		confidence: "medium",
	},

	// Video Creator patterns
	{
		pattern: /\b(video|remotion|animation|motion graphic|screen recording|tutorial video)\b/i,
		role: TaskRole.VideoCreator,
		confidence: "medium",
	},

	// Planner patterns
	{
		pattern: /\b(plan|architect|design system|break down|decompose|roadmap|strategy)\b/i,
		role: TaskRole.Planner,
		confidence: "medium",
	},

	// Images patterns
	{
		pattern: /\b(generate image|create image|logo|icon|illustration|dall-e|flux|sdxl|stable diffusion)\b/i,
		role: TaskRole.Images,
		confidence: "medium",
	},
]

/**
 * Classify the current task context into a TaskRole.
 *
 * Priority order:
 *  1. File extension (highest — most deterministic)
 *  2. Tool call name
 *  3. Content patterns (lowest — most ambiguous)
 *
 * Returns Primary if no specialist match found.
 */
export function classifyTask(context: ClassificationContext): ClassificationResult {
	// 1. Check file extensions being edited
	if (context.activeFiles && context.activeFiles.length > 0) {
		for (const filePath of context.activeFiles) {
			const role = classifyByExtension(filePath)
			if (role) {
				return {
					role,
					confidence: "high",
					reason: `File extension match: ${filePath}`,
				}
			}
		}
	}

	// 2. Check tool calls
	if (context.pendingToolName) {
		const role = classifyByTool(context.pendingToolName)
		if (role) {
			return {
				role,
				confidence: "high",
				reason: `Tool match: ${context.pendingToolName}`,
			}
		}
	}

	// 3. Check content patterns in the latest user message
	if (context.latestUserMessage) {
		for (const { pattern, role, confidence } of CONTENT_PATTERNS) {
			if (pattern.test(context.latestUserMessage)) {
				return {
					role,
					confidence,
					reason: `Content pattern match: ${pattern.source}`,
				}
			}
		}
	}

	// 4. Default to Primary
	return {
		role: TaskRole.Primary,
		confidence: "high",
		reason: "No specialist match — using Primary model",
	}
}

/**
 * Classify a file path by its extension.
 * Handles compound extensions (e.g., .styled.ts, .module.css).
 */
function classifyByExtension(filePath: string): TaskRole | undefined {
	const lower = filePath.toLowerCase()

	// Check compound extensions first (more specific)
	for (const [ext, role] of Object.entries(EXTENSION_ROLE_MAP)) {
		if (ext.includes(".") && ext.split(".").length > 2 && lower.endsWith(ext)) {
			return role
		}
	}

	// Check simple extensions
	const lastDot = lower.lastIndexOf(".")
	if (lastDot === -1) return undefined

	const ext = lower.slice(lastDot)
	return EXTENSION_ROLE_MAP[ext]
}

/**
 * Classify by tool name — checks if the tool name contains a role-mapped keyword.
 */
function classifyByTool(toolName: string): TaskRole | undefined {
	const lower = toolName.toLowerCase()
	for (const [keyword, role] of Object.entries(TOOL_ROLE_MAP)) {
		if (lower.includes(keyword)) {
			return role
		}
	}
	return undefined
}

/**
 * Context passed to the classifier.
 * Built from the current Task state — no extra LLM calls needed.
 */
export interface ClassificationContext {
	/** Files currently being edited or referenced in this request */
	activeFiles?: string[]
	/** Name of the tool the agent is about to call (if any) */
	pendingToolName?: string
	/** The latest user message text (for content pattern matching) */
	latestUserMessage?: string
}
