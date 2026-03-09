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
	// Note: .rs is intentionally excluded — Rust is used for many non-Web3 things.
	// Web3 Rust files are caught by content patterns ("anchor", "solana") instead.
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
	run_lint_check: TaskRole.ErrorChecker,
	run_test_suite: TaskRole.ErrorChecker,

	// Browser / visual tools → Designer
	browser_action: TaskRole.Designer,
	take_screenshot: TaskRole.Designer,

	// File reading is neutral — doesn't trigger a role
}

/**
 * Content pattern keywords → role mapping (checked against user message).
 *
 * IMPORTANT: Patterns use multi-word phrases and specific terms to avoid
 * false positives on common English words. Order matters — first match wins.
 * Web3 patterns are checked first because they're the most specific.
 */
const CONTENT_PATTERNS: Array<{ pattern: RegExp; role: TaskRole; confidence: "high" | "medium" }> = [
	// Web3 patterns — most specific, checked first
	{
		pattern:
			/\b(solidity|smart\s*contract|erc-?20|erc-?721|erc-?1155|hardhat|foundry|anchor\s+program|solana\s+program|web3\.?js|ethers\.?js|wagmi|pump\.fun|ipfs|blockchain|dapp)\b/i,
		role: TaskRole.Web3Developer,
		confidence: "high",
	},

	// Auditor patterns — require compound terms to avoid matching "review this code"
	{
		pattern:
			/\b(security\s+audit|security\s+review|code\s+review|vulnerability\s+scan|penetration\s+test|security\s+vulnerabilit)\b/i,
		role: TaskRole.Auditor,
		confidence: "medium",
	},

	// Designer patterns — specific CSS/UI terms, not generic "design"
	{
		pattern:
			/\b(css\s+layout|fix\s+the\s+css|tailwind|responsive\s+design|ui\s+component|ux\s+design|color\s+palette|dark\s+mode|font\s+size|flexbox|grid\s+layout|styled-component)\b/i,
		role: TaskRole.Designer,
		confidence: "medium",
	},

	// Document Writer patterns — require documentation-specific terms
	{
		pattern:
			/\b(write\s+docs|api\s+docs|update\s+readme|documentation|changelog|jsdoc|tsdoc|write\s+the\s+readme|docstring)\b/i,
		role: TaskRole.DocumentWriter,
		confidence: "medium",
	},

	// Video Creator patterns — Remotion-specific
	{
		pattern: /\b(remotion|video\s+composition|motion\s+graphic|screen\s+recording|tutorial\s+video|create\s+a\s+video)\b/i,
		role: TaskRole.VideoCreator,
		confidence: "medium",
	},

	// Planner patterns — require planning-specific compound terms
	{
		pattern:
			/\b(plan\s+the\s+architecture|design\s+system|break\s+down\s+the|decompose|implementation\s+plan|technical\s+roadmap|architect\s+the)\b/i,
		role: TaskRole.Planner,
		confidence: "medium",
	},

	// Images patterns — require image-specific compound terms
	{
		pattern:
			/\b(generate\s+(?:an?\s+)?image|create\s+(?:an?\s+)?image|dall-e|flux|sdxl|stable\s+diffusion|generate\s+(?:a\s+)?logo|create\s+(?:an?\s+)?icon|image\s+generation)\b/i,
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
