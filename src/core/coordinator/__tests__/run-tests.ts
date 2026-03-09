/**
 * Standalone test runner for coordinator module.
 * Self-contained — no heavy import chains, just tests the classifier and types.
 * Run with: npx tsx src/core/coordinator/__tests__/run-tests.ts
 */

// ── Direct imports from our own files only ──

import { classifyTask } from "../classifier"
import { getRoleLabel, getRoleOverlay } from "../role-prompts"
import { DEFAULT_COORDINATOR_SETTINGS, TaskRole } from "../types"

let passed = 0
let failed = 0

function assert(condition: boolean, name: string) {
	if (condition) {
		passed++
		console.log(`  ✅ ${name}`)
	} else {
		failed++
		console.error(`  ❌ ${name}`)
	}
}

// biome-ignore lint/suspicious/noExplicitAny: test assertion helper needs flexible types
function assertEqual(actual: any, expected: any, name: string) {
	assert(actual === expected, `${name} — expected "${expected}", got "${actual}"`)
}

// ───── CLASSIFIER TESTS — FILE EXTENSIONS ─────

console.log("\n📋 Classifier Tests — File Extensions")

assertEqual(classifyTask({ activeFiles: ["main.css"] }).role, TaskRole.Designer, "CSS → Designer")
assertEqual(classifyTask({ activeFiles: ["theme.scss"] }).role, TaskRole.Designer, "SCSS → Designer")
assertEqual(classifyTask({ activeFiles: ["app.less"] }).role, TaskRole.Designer, "LESS → Designer")
assertEqual(classifyTask({ activeFiles: ["Button.styled.ts"] }).role, TaskRole.Designer, "styled.ts → Designer")
assertEqual(classifyTask({ activeFiles: ["app.module.css"] }).role, TaskRole.Designer, "module.css → Designer")
assertEqual(classifyTask({ activeFiles: ["Token.sol"] }).role, TaskRole.Web3Developer, "SOL → Web3Developer")
assertEqual(classifyTask({ activeFiles: ["Move.move"] }).role, TaskRole.Web3Developer, "MOVE → Web3Developer")
assertEqual(classifyTask({ activeFiles: ["Token.vy"] }).role, TaskRole.Web3Developer, "VY → Web3Developer")
assertEqual(classifyTask({ activeFiles: ["README.md"] }).role, TaskRole.DocumentWriter, "MD → DocumentWriter")
assertEqual(classifyTask({ activeFiles: ["docs.mdx"] }).role, TaskRole.DocumentWriter, "MDX → DocumentWriter")
assertEqual(classifyTask({ activeFiles: ["notes.txt"] }).role, TaskRole.DocumentWriter, "TXT → DocumentWriter")
assertEqual(classifyTask({ activeFiles: ["package.json"] }).role, TaskRole.FastEdits, "JSON → FastEdits")
assertEqual(classifyTask({ activeFiles: ["config.yml"] }).role, TaskRole.FastEdits, "YML → FastEdits")
assertEqual(classifyTask({ activeFiles: ["config.yaml"] }).role, TaskRole.FastEdits, "YAML → FastEdits")
assertEqual(classifyTask({ activeFiles: ["Cargo.toml"] }).role, TaskRole.FastEdits, "TOML → FastEdits")
assertEqual(classifyTask({ activeFiles: [".env"] }).role, TaskRole.FastEdits, "ENV → FastEdits")
assertEqual(classifyTask({ activeFiles: [".gitignore"] }).role, TaskRole.FastEdits, "GITIGNORE → FastEdits")

// Fix #1: .rs should NOT map to Web3Developer
assertEqual(classifyTask({ activeFiles: ["main.rs"] }).role, TaskRole.Primary, "RS → Primary (not Web3)")
assertEqual(classifyTask({ activeFiles: ["lib.rs"] }).role, TaskRole.Primary, "lib.rs → Primary (not Web3)")

assertEqual(classifyTask({ activeFiles: ["main.py"] }).role, TaskRole.Primary, "PY → Primary (unmapped)")
assertEqual(classifyTask({ activeFiles: ["index.ts"] }).role, TaskRole.Primary, "TS → Primary (unmapped)")

// ───── CLASSIFIER TESTS — TOOL NAMES ─────

console.log("\n📋 Classifier Tests — Tool Names (exact match)")

assertEqual(classifyTask({ pendingToolName: "diagnostics" }).role, TaskRole.ErrorChecker, "diagnostics → ErrorChecker")
assertEqual(classifyTask({ pendingToolName: "run_lint_check" }).role, TaskRole.ErrorChecker, "run_lint_check → ErrorChecker")
assertEqual(classifyTask({ pendingToolName: "run_test_suite" }).role, TaskRole.ErrorChecker, "run_test_suite → ErrorChecker")
assertEqual(classifyTask({ pendingToolName: "browser_action" }).role, TaskRole.Designer, "browser_action → Designer")
assertEqual(classifyTask({ pendingToolName: "take_screenshot" }).role, TaskRole.Designer, "take_screenshot → Designer")
assertEqual(classifyTask({ pendingToolName: "write_to_file" }).role, TaskRole.Primary, "write_to_file → Primary (no match)")
// Exact matching means partial names don't trigger false positives
assertEqual(classifyTask({ pendingToolName: "test" }).role, TaskRole.Primary, "bare 'test' → Primary (no partial match)")
assertEqual(classifyTask({ pendingToolName: "lint" }).role, TaskRole.Primary, "bare 'lint' → Primary (no partial match)")

// ───── CLASSIFIER TESTS — CONTENT PATTERNS (tightened) ─────

console.log("\n📋 Classifier Tests — Content Patterns (compound phrases)")

// Web3 — specific terms
assertEqual(
	classifyTask({ latestUserMessage: "Write a Solidity smart contract" }).role,
	TaskRole.Web3Developer,
	"Solidity → Web3",
)
assertEqual(classifyTask({ latestUserMessage: "Deploy the ERC-20 token" }).role, TaskRole.Web3Developer, "ERC-20 → Web3")
assertEqual(classifyTask({ latestUserMessage: "Use Hardhat to test" }).role, TaskRole.Web3Developer, "Hardhat → Web3")
assertEqual(classifyTask({ latestUserMessage: "Build an anchor program" }).role, TaskRole.Web3Developer, "anchor program → Web3")
assertEqual(classifyTask({ latestUserMessage: "Create a dapp for trading" }).role, TaskRole.Web3Developer, "dapp → Web3")

// Auditor — compound terms only
assertEqual(
	classifyTask({ latestUserMessage: "Do a security review of the contract" }).role,
	TaskRole.Auditor,
	"security review → Auditor",
)
assertEqual(classifyTask({ latestUserMessage: "Run a code review on the PR" }).role, TaskRole.Auditor, "code review → Auditor")
// Fix #3: bare "review" should NOT match Auditor
assertEqual(
	classifyTask({ latestUserMessage: "Review this PR and merge" }).role,
	TaskRole.Primary,
	"bare 'review' → Primary (no false positive)",
)

// Designer — specific CSS/UI terms
assertEqual(
	classifyTask({ latestUserMessage: "Fix the CSS layout for the header" }).role,
	TaskRole.Designer,
	"CSS layout → Designer",
)
assertEqual(classifyTask({ latestUserMessage: "Add a dark mode toggle" }).role, TaskRole.Designer, "dark mode → Designer")
assertEqual(classifyTask({ latestUserMessage: "Use tailwind for styling" }).role, TaskRole.Designer, "tailwind → Designer")
// Fix #3: bare "design" should NOT match Designer
assertEqual(
	classifyTask({ latestUserMessage: "Design the login page flow" }).role,
	TaskRole.Primary,
	"bare 'design' → Primary (no false positive)",
)

// Document Writer
assertEqual(
	classifyTask({ latestUserMessage: "Write the documentation for this API" }).role,
	TaskRole.DocumentWriter,
	"documentation → DocWriter",
)
assertEqual(
	classifyTask({ latestUserMessage: "Update readme with install steps" }).role,
	TaskRole.DocumentWriter,
	"update readme → DocWriter",
)

// Video Creator — Remotion-specific
assertEqual(classifyTask({ latestUserMessage: "Create a Remotion video" }).role, TaskRole.VideoCreator, "Remotion → VideoCreator")
// Fix #3: bare "video" should NOT match VideoCreator
assertEqual(
	classifyTask({ latestUserMessage: "I saw a video about it" }).role,
	TaskRole.Primary,
	"bare 'video' → Primary (no false positive)",
)

// Planner — compound terms
assertEqual(
	classifyTask({ latestUserMessage: "Plan the architecture for the new service" }).role,
	TaskRole.Planner,
	"plan the architecture → Planner",
)
assertEqual(
	classifyTask({ latestUserMessage: "Create an implementation plan" }).role,
	TaskRole.Planner,
	"implementation plan → Planner",
)
// Fix #3: bare "plan" should NOT match Planner
assertEqual(
	classifyTask({ latestUserMessage: "I plan to fix the bug tomorrow" }).role,
	TaskRole.Primary,
	"bare 'plan' → Primary (no false positive)",
)

// Images — compound terms
assertEqual(
	classifyTask({ latestUserMessage: "Generate an image for the logo" }).role,
	TaskRole.Images,
	"generate an image → Images",
)
assertEqual(
	classifyTask({ latestUserMessage: "Use stable diffusion for art" }).role,
	TaskRole.Images,
	"stable diffusion → Images",
)

// Generic → Primary
assertEqual(classifyTask({ latestUserMessage: "Implement the login function" }).role, TaskRole.Primary, "generic → Primary")

// ───── PRIORITY ORDER ─────

console.log("\n📋 Classifier Tests — Priority Order")

assertEqual(
	classifyTask({ activeFiles: ["Token.sol"], latestUserMessage: "Fix the CSS layout" }).role,
	TaskRole.Web3Developer,
	"file ext beats content pattern",
)
assertEqual(
	classifyTask({ activeFiles: ["styles.css"], pendingToolName: "diagnostics" }).role,
	TaskRole.Designer,
	"file ext beats tool name",
)
assertEqual(
	classifyTask({ pendingToolName: "diagnostics", latestUserMessage: "Fix the CSS layout" }).role,
	TaskRole.ErrorChecker,
	"tool name beats content pattern",
)

// ───── EDGE CASES ─────

console.log("\n📋 Classifier Tests — Edge Cases")

assertEqual(classifyTask({}).role, TaskRole.Primary, "empty context → Primary")
assertEqual(classifyTask({ activeFiles: [] }).role, TaskRole.Primary, "empty files → Primary")
assertEqual(classifyTask({ latestUserMessage: "" }).role, TaskRole.Primary, "empty message → Primary")
assertEqual(classifyTask({ activeFiles: ["Dockerfile"] }).role, TaskRole.Primary, "no extension → Primary")
assertEqual(classifyTask({}).confidence, "high", "Primary always has high confidence")

// ───── ROLE PROMPTS TESTS ─────

console.log("\n📝 Role Prompts Tests")

assert(getRoleOverlay(TaskRole.Designer).includes("DESIGNER"), "Designer overlay contains role label")
assert(getRoleOverlay(TaskRole.Web3Developer).includes("WEB3"), "Web3 overlay contains role label")
assert(getRoleOverlay(TaskRole.Auditor).includes("AUDITOR"), "Auditor overlay contains role label")
assert(getRoleOverlay(TaskRole.Primary) === "", "Primary has no overlay")
assert(getRoleOverlay(TaskRole.Designer).includes("SPECIALIST CONTEXT"), "Overlay has section delimiters")

// Custom overlay
const customOverlay = getRoleOverlay(TaskRole.Designer, "Custom designer instructions here")
assert(customOverlay.includes("Custom designer instructions here"), "Custom overlay overrides builtin")
assert(!customOverlay.includes("visual design"), "Custom overlay replaces builtin content")

// Labels
assertEqual(getRoleLabel(TaskRole.Designer), "Designer", "Designer label")
assertEqual(getRoleLabel(TaskRole.Web3Developer), "Web3 Developer", "Web3 label")
assertEqual(getRoleLabel(TaskRole.ErrorChecker), "Error Checker", "ErrorChecker label")
assertEqual(getRoleLabel(TaskRole.Primary), "Primary", "Primary label")

// ───── TYPES TESTS ─────

console.log("\n🔧 Types Tests")

assert(DEFAULT_COORDINATOR_SETTINGS.enabled === false, "Default settings: disabled")
assert(Object.keys(DEFAULT_COORDINATOR_SETTINGS.roleAssignments).length === 0, "Default settings: no role assignments")
assert(DEFAULT_COORDINATOR_SETTINGS.showStatusBarIndicator === true, "Default settings: show status bar")

// Enum values
assertEqual(TaskRole.Primary, "primary", "TaskRole.Primary value")
assertEqual(TaskRole.Designer, "designer", "TaskRole.Designer value")
assertEqual(TaskRole.Web3Developer, "web3_developer", "TaskRole.Web3Developer value")

// ───── SUMMARY ─────

console.log(`\n${"═".repeat(50)}`)
console.log(`📊 ${passed + failed} tests, ${passed} passed, ${failed} failed`)
console.log(`${"═".repeat(50)}\n`)

process.exit(failed > 0 ? 1 : 0)
