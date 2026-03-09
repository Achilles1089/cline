import { DEFAULT_COORDINATOR_SETTINGS, type CoordinatorSettings, type RoleConfig, TaskRole } from "../../../../../src/core/coordinator/types"
import { memo, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useExtensionState } from "@/context/ExtensionStateContext"
import Section from "../Section"
import { updateSetting } from "../utils/settingsHandlers"

/** Providers shown at the top of the dropdown (most commonly used) */
const TOP_PROVIDERS = ["anthropic", "openai", "gemini", "openrouter", "deepseek", "ollama", "bedrock", "vertex"] as const

/** All remaining providers in alphabetical order */
const OTHER_PROVIDERS = [
    "aihubmix", "asksage", "baseten", "cerebras", "claude-code", "cline", "dify", "doubao",
    "fireworks", "groq", "hicap", "huawei-cloud-maas", "huggingface", "litellm", "lmstudio",
    "minimax", "mistral", "moonshot", "nebius", "nousResearch", "oca", "openai-codex",
    "openai-native", "qwen", "qwen-code", "requesty", "sambanova", "sapaicore", "together",
    "vercel-ai-gateway", "vscode-lm", "xai", "zai",
] as const

/** Model placeholder hints per provider */
const MODEL_HINTS: Record<string, string> = {
    anthropic: "claude-sonnet-4-20250514",
    openai: "gpt-4o",
    gemini: "gemini-2.5-pro",
    openrouter: "anthropic/claude-sonnet-4-20250514",
    deepseek: "deepseek-chat",
    ollama: "llama3.1:latest",
    bedrock: "anthropic.claude-sonnet-4-20250514-v1:0",
    vertex: "claude-sonnet-4@20250514",
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
    designer: "Frontend, CSS, UI/UX, component layout",
    coder: "General implementation, refactoring, debugging",
    planner: "Architecture, system design, task breakdown",
    web3_developer: "Solidity, smart contracts, blockchain",
    devops: "CI/CD, Docker, deployment, infrastructure",
    data_engineer: "Databases, migrations, queries, schemas",
    tester: "Unit tests, integration tests, QA",
    security: "Auth, encryption, vulnerability scanning",
    researcher: "Docs, API exploration, web search",
    images: "Image generation and visual assets",
}

interface RoleCardProps {
    role: string
    config: RoleConfig | undefined
    onUpdate: (role: string, config: Partial<RoleConfig>) => void
}

const RoleCard = memo(({ role, config, onUpdate }: RoleCardProps) => {
    const isEnabled = config?.enabled ?? false
    const label = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    const modelPlaceholder = config?.apiProvider
        ? MODEL_HINTS[config.apiProvider] ?? "model-id"
        : "Select a provider first"

    return (
        <div className="rounded-md border border-editor-widget-border/50 p-3">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-description">{ROLE_DESCRIPTIONS[role] ?? "Specialist role"}</div>
                </div>
                <Switch
                    checked={isEnabled}
                    id={`role-${role}`}
                    onCheckedChange={(checked) => onUpdate(role, { enabled: checked })}
                    size="lg"
                />
            </div>
            {isEnabled && (
                <div className="space-y-2 mt-3 pl-1 border-l-2 border-editor-widget-border/30 ml-1">
                    <div className="space-y-1 pl-2">
                        <Label className="text-xs text-description">Provider</Label>
                        <Select
                            onValueChange={(v) => onUpdate(role, { apiProvider: v === "__primary__" ? "" : v })}
                            value={config?.apiProvider ?? "__primary__"}
                        >
                            <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__primary__">Use Primary</SelectItem>
                                {TOP_PROVIDERS.map((p) => (
                                    <SelectItem key={p} value={p}>
                                        {p}
                                    </SelectItem>
                                ))}
                                {OTHER_PROVIDERS.map((p) => (
                                    <SelectItem key={p} value={p}>
                                        {p}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1 pl-2">
                        <Label className="text-xs text-description">Model ID</Label>
                        <Input
                            className="h-7 text-xs"
                            onChange={(e) => onUpdate(role, { modelId: e.target.value || "" })}
                            onKeyDown={(e) => e.stopPropagation()}
                            placeholder={modelPlaceholder}
                            value={config?.modelId ?? ""}
                        />
                    </div>
                    <div className="space-y-1 pl-2">
                        <Label className="text-xs text-description">Prompt Overlay (optional)</Label>
                        <textarea
                            className="min-h-[60px] text-xs resize-y w-full rounded-md border border-input bg-background px-3 py-2"
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdate(role, { customPromptOverlay: e.target.value || "" })}
                            onKeyDown={(e) => e.stopPropagation()}
                            placeholder="Override the default role prompt..."
                            value={config?.customPromptOverlay ?? ""}
                        />
                    </div>
                </div>
            )}
        </div>
    )
})

interface CoordinatorSettingsSectionProps {
    renderSectionHeader: (tabId: string) => JSX.Element | null
}

const CoordinatorSettingsSection = ({ renderSectionHeader }: CoordinatorSettingsSectionProps) => {
    const { coordinatorSettings } = useExtensionState()
    const settings: CoordinatorSettings = coordinatorSettings ?? DEFAULT_COORDINATOR_SETTINGS

    const handleToggle = useCallback(
        (field: keyof CoordinatorSettings, value: boolean) => {
            updateSetting("coordinatorSettings", {
                [field]: value,
            })
        },
        [],
    )

    const handleRoleUpdate = useCallback(
        (role: string, patch: Partial<RoleConfig>) => {
            const currentConfig = settings.roleAssignments[role as TaskRole] ?? { enabled: false }
            const updatedConfig = { ...currentConfig, ...patch }

            // Build the proto-compatible update with role assignments as a map
            updateSetting("coordinatorSettings", {
                enabled: settings.enabled,
                showStatusBarIndicator: settings.showStatusBarIndicator,
                roleAssignments: {
                    [role]: updatedConfig,
                },
            })
        },
        [settings],
    )

    const roles = Object.keys(ROLE_DESCRIPTIONS)

    return (
        <div className="mb-2">
            {renderSectionHeader("coordinator")}
            <Section>
                {/* Master toggle */}
                <div className="flex items-center justify-between py-3">
                    <div>
                        <div className="text-sm font-medium">Enable Multi-Model Coordinator</div>
                        <div className="text-xs text-description">
                            Route tasks to specialist models based on what Dappit is doing
                        </div>
                    </div>
                    <Switch
                        checked={settings.enabled}
                        id="coordinator-enabled"
                        onCheckedChange={(checked) => handleToggle("enabled", checked)}
                        size="lg"
                    />
                </div>

                {settings.enabled && (
                    <>
                        {/* Status bar toggle */}
                        <div className="flex items-center justify-between py-3 border-t border-editor-widget-border/30">
                            <div>
                                <div className="text-sm font-medium">Status Bar Indicator</div>
                                <div className="text-xs text-description">
                                    Show the active specialist role in the status bar
                                </div>
                            </div>
                            <Switch
                                checked={settings.showStatusBarIndicator}
                                id="coordinator-status-bar"
                                onCheckedChange={(checked) => handleToggle("showStatusBarIndicator", checked)}
                                size="lg"
                            />
                        </div>

                        {/* Role assignments */}
                        <div className="mt-4">
                            <div className="text-xs font-medium text-foreground/80 uppercase tracking-wider mb-3">
                                Role Assignments
                            </div>
                            <div className="text-xs text-description mb-3">
                                Enable roles and assign specific models. Unassigned roles use your primary model.
                            </div>
                            <div className="space-y-2">
                                {roles.map((role) => (
                                    <RoleCard
                                        config={settings.roleAssignments[role as TaskRole]}
                                        key={role}
                                        onUpdate={handleRoleUpdate}
                                        role={role}
                                    />
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </Section>
        </div>
    )
}

export default memo(CoordinatorSettingsSection)
