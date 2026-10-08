// Sample data for demo mode: four fictional projects with threads in every state.
import type { ConfigOption, Entry, GitStatus, PendingElicitation, PendingPermission, Project, QueuedMessage, ThreadDetail } from "../api";

const MIN = 60_000;

export const claudeOpts = (mode = "default"): ConfigOption[] => [
  {
    id: "mode",
    name: "Mode",
    category: "mode",
    currentValue: mode,
    options: [
      { value: "default", name: "Default", description: "Ask before edits and commands" },
      { value: "acceptEdits", name: "Accept Edits", description: "Auto-approve file edits" },
      { value: "plan", name: "Plan Mode", description: "Read-only planning" },
      { value: "bypassPermissions", name: "Bypass Permissions", description: "Skip all prompts" },
    ],
  },
  {
    id: "model",
    name: "Model",
    category: "model",
    currentValue: "opus",
    options: [
      { value: "opus", name: "Opus 5.5", description: "Most capable" },
      { value: "sonnet", name: "Sonnet 5.5", description: "Fast and capable" },
      { value: "haiku", name: "Haiku 4.5", description: "Fastest" },
    ],
  },
  { id: "effort", name: "Effort", category: "thought_level", currentValue: "medium", options: [{ value: "low", name: "Low" }, { value: "medium", name: "Medium" }, { value: "high", name: "High" }, { value: "max", name: "Max" }] },
  { id: "fast", name: "Fast mode", type: "boolean", currentValue: false },
];

export const codexOpts = (): ConfigOption[] => [
  { id: "mode", name: "Mode", category: "mode", currentValue: "auto", options: [{ value: "read-only", name: "Read Only" }, { value: "auto", name: "Default" }, { value: "full-access", name: "Full Access" }] },
  { id: "model", name: "Model", category: "model", currentValue: "gpt-5.5", options: [{ value: "gpt-5.5", name: "gpt-5.5" }, { value: "gpt-5.5-mini", name: "gpt-5.5-mini" }] },
  { id: "effort", name: "Reasoning", category: "thought_level", currentValue: "high", options: [{ value: "low", name: "Low" }, { value: "medium", name: "Medium" }, { value: "high", name: "High" }] },
];

export const commands = [
  { name: "review", description: "Review the current changes for bugs and style issues" },
  { name: "compact", description: "Summarize the conversation to free up context", input: { hint: "focus" } },
  { name: "init", description: "Create a CLAUDE.md with notes about this codebase" },
  { name: "security-review", description: "Look for vulnerabilities in pending changes" },
  { name: "test", description: "Run the test suite and fix failures" },
  { name: "explain", description: "Explain a file or symbol", input: { hint: "path or symbol" } },
];

const darkDiffOld = `export function SettingsScreen() {
  const { notifications, setNotifications } = useSettings();
  return (
    <Screen title="Settings">
      <Row label="Notifications">
        <Switch value={notifications} onChange={setNotifications} />
      </Row>
    </Screen>
  );
}`;
const darkDiffNew = `export function SettingsScreen() {
  const { notifications, setNotifications, theme, setTheme } = useSettings();
  return (
    <Screen title="Settings">
      <Row label="Notifications">
        <Switch value={notifications} onChange={setNotifications} />
      </Row>
      <Row label="Appearance">
        <Segmented options={["System", "Light", "Dark"]} value={theme} onChange={setTheme} />
      </Row>
    </Screen>
  );
}`;

type Detail = { entries: Entry[]; configOptions?: ConfigOption[]; usage?: ThreadDetail["usage"]; queued?: QueuedMessage[]; pendingPermissions?: PendingPermission[]; pendingElicitations?: PendingElicitation[] };

/** A fresh copy of the demo world, with times relative to `now`. */
export function seed(now: number): { projects: Project[]; details: Record<string, Detail> } {
  const ago = (m: number) => now - m * MIN;
  const T = (o: Partial<Project["threads"][number]> & { id: string; title: string; cwd: string; kind: string; status: any }) => ({
    synced: true,
    online: true,
    unread: false,
    archived: false,
    agentId: o.kind,
    agentName: o.kind === "codex" ? "Codex" : "Claude Agent",
    createdAt: ago(30),
    updatedAt: ago(1),
    ...o,
  });
  const P = (name: string, threads: Project["threads"]): Project => ({ name, path: `/Users/demo/code/${name}`, paths: [`/Users/demo/code/${name}`], expanded: true, threads });
  const cwd = (n: string) => `/Users/demo/code/${n}`;

  const projects = [
    P("aurora-ui", [
      T({ id: "t-dark", title: "Add dark mode to the settings screen", kind: "claude", status: "running", createdAt: ago(9), updatedAt: ago(0.2), cwd: cwd("aurora-ui"), preview: "Wiring the theme toggle into the settings store…" }),
      T({ id: "t-flaky", title: "Fix flaky checkout e2e test", kind: "claude", status: "idle", unread: true, createdAt: ago(48), updatedAt: ago(6), cwd: cwd("aurora-ui"), preview: "The race was in the cart hydration — fixed and ran it 50×, all green." }),
      T({ id: "t-a11y", title: "Audit buttons for accessibility", kind: "codex", status: "idle", online: false, createdAt: ago(60 * 26), updatedAt: ago(60 * 22), cwd: cwd("aurora-ui") }),
    ]),
    P("pocket-ledger", [
      T({ id: "t-stripe", title: "Migrate payments to the new billing API", kind: "claude", status: "needs_permission", createdAt: ago(31), updatedAt: ago(1), cwd: cwd("pocket-ledger") }),
      T({ id: "t-csv", title: "CSV import for bank statements", kind: "claude", status: "idle", createdAt: ago(60 * 5), updatedAt: ago(60 * 3), cwd: cwd("pocket-ledger") }),
    ]),
    P("trailhead-api", [
      T({ id: "t-rate", title: "Rate limiting for the public API", kind: "codex", status: "needs_permission", createdAt: ago(14), updatedAt: ago(2), cwd: cwd("trailhead-api") }),
      T({ id: "t-docs", title: "Generate OpenAPI docs", kind: "codex", status: "running", createdAt: ago(5), updatedAt: ago(0.5), cwd: cwd("trailhead-api") }),
    ]),
    P("noted", [T({ id: "t-sync", title: "Offline sync with conflict resolution", kind: "claude", status: "idle", online: false, createdAt: ago(60 * 50), updatedAt: ago(60 * 47), cwd: cwd("noted") })]),
  ];

  const details: Record<string, Detail> = {
    "t-dark": {
      queued: [{ id: "q1", text: "Also add a high-contrast option", images: 0, createdAt: ago(1) }],
      configOptions: claudeOpts("acceptEdits"),
      usage: { used: 61_000, size: 200_000, cost: { amount: 0.84, currency: "USD" } },
      entries: [
        { seq: 1, kind: "user", text: "Add a dark mode toggle to the settings screen. It should follow the system by default." },
        { seq: 2, kind: "thought", text: "Settings live in `useSettings` and colors come from `ThemeProvider`. I'll add a `theme` field, a segmented control, then switch the palette." },
        { seq: 3, kind: "tool_call", toolCallId: "c1", title: "Read src/settings/store.ts", status: "completed", data: { kind: "read" } },
        {
          seq: 4,
          kind: "plan",
          data: [
            { content: "Add theme to the settings store", status: "completed", priority: "high" },
            { content: "Appearance row on the settings screen", status: "completed", priority: "high" },
            { content: "Wire theme into ThemeProvider", status: "in_progress", priority: "high" },
            { content: "Persist choice and respect system setting", status: "pending", priority: "medium" },
          ],
        },
        { seq: 5, kind: "tool_call", toolCallId: "c2", title: "Edit src/screens/SettingsScreen.tsx", status: "completed", data: { kind: "edit", content: [{ type: "diff", path: "src/screens/SettingsScreen.tsx", oldText: darkDiffOld, newText: darkDiffNew }] } },
        {
          seq: 6,
          kind: "agent",
          text: "Added an **Appearance** row with *System / Light / Dark*. Next I'm wiring it into the theme:\n\n| Choice | Palette |\n|---|---|\n| System | follows `Appearance.getColorScheme()` |\n| Light | `latte` |\n| Dark | `mocha` |",
        },
        { seq: 7, kind: "tool_call", toolCallId: "c3", title: "Edit src/theme/ThemeProvider.tsx", status: "in_progress", data: { kind: "edit" } },
      ],
    },
    "t-flaky": {
      configOptions: claudeOpts(),
      usage: { used: 38_000, size: 200_000 },
      entries: [
        { seq: 1, kind: "user", text: "checkout.spec.ts fails maybe 1 in 10 runs on CI. Find out why and fix it." },
        {
          seq: 2,
          kind: "tool_call",
          toolCallId: "f1",
          title: "npx playwright test checkout --repeat-each=20",
          status: "completed",
          data: {
            kind: "execute",
            rawInput: { command: "npx playwright test checkout --repeat-each=20", cwd: "/Users/demo/code/aurora-ui" },
            content: [
              {
                type: "content",
                content: {
                  type: "text",
                  text: [
                    "Running 20 tests using 4 workers",
                    "",
                    "  \x1b[32m✓\x1b[0m checkout › shows the cart total \x1b[2m(812ms)\x1b[0m",
                    "  \x1b[32m✓\x1b[0m checkout › removes an item \x1b[2m(640ms)\x1b[0m",
                    "  \x1b[31m✘\x1b[0m checkout › applies discount code \x1b[2m(5.0s)\x1b[0m",
                    "  \x1b[32m✓\x1b[0m checkout › pays with a saved card \x1b[2m(1.1s)\x1b[0m",
                    "",
                    "  \x1b[41m\x1b[1m FAILED \x1b[0m \x1b[1mcheckout › applies discount code\x1b[0m",
                    "  Timeout 5000ms waiting for \x1b[36m[data-test=total]\x1b[0m",
                    "    at \x1b[32mtests/checkout.spec.ts:42\x1b[0m",
                    "",
                    "  \x1b[31m2 failed\x1b[0m",
                    "  \x1b[32m18 passed\x1b[0m \x1b[2m(41.2s)\x1b[0m",
                  ].join("\n"),
                },
              },
            ],
          },
        },
        {
          seq: 3,
          kind: "agent",
          text: "Found it. The cart hydrates from storage **after** the first render, so on slow runs the test reads the total before the discount is applied.\n\n- Wait for `cart.hydrated` before rendering the summary\n- Replace the fixed `waitForTimeout(500)` with an assertion on the total\n\n```ts\nawait expect(page.getByTestId(\"total\")).toHaveText(\"$42.30\");\n```\n\nRan it 50× locally: **50 passed**.",
        },
      ],
    },
    "t-stripe": {
      configOptions: claudeOpts(),
      usage: { used: 92_000, size: 200_000, cost: { amount: 1.37, currency: "USD" } },
      pendingPermissions: [
        {
          requestId: 7,
          toolCall: { title: "npm test -- billing --coverage" },
          options: [
            { optionId: "allow_always", name: "Always allow", kind: "allow_always" },
            { optionId: "allow", name: "Allow", kind: "allow_once" },
            { optionId: "reject", name: "Reject", kind: "reject_once" },
          ],
        },
      ],
      entries: [
        { seq: 1, kind: "user", text: "Move us from the legacy charges endpoint to the new billing API. Keep the webhook payloads backwards compatible." },
        { seq: 2, kind: "tool_call", toolCallId: "s1", title: 'Search "charges.create"', status: "completed", data: { kind: "search", content: [{ type: "content", content: { type: "text", text: "src/billing/charge.ts:18\nsrc/billing/refund.ts:9\nsrc/jobs/renewals.ts:44" } }] } },
        { seq: 3, kind: "agent", text: "Three call sites use the legacy endpoint. I've moved all of them to `billing.invoices.create` behind a small adapter so the webhook shape stays the same.\n\nI'd like to run the billing tests before going further." },
        { seq: 4, kind: "tool_call", toolCallId: "s2", title: "npm test -- billing --coverage", status: "pending", data: { kind: "execute" } },
      ],
    },
    "t-rate": {
      configOptions: codexOpts(),
      usage: { used: 22_000, size: 272_000 },
      pendingElicitations: [
        {
          requestId: 3,
          mode: "form",
          message: "How should rate limits be applied?",
          requestedSchema: {
            type: "object",
            properties: {
              strategy: {
                type: "string",
                title: "Limit by",
                oneOf: [
                  { const: "key", title: "API key", description: "Each key gets its own budget" },
                  { const: "ip", title: "IP address", description: "Simple, but shared offices hit limits" },
                  { const: "both", title: "Both", description: "Key first, IP as a fallback" },
                ],
              },
              store: {
                type: "string",
                title: "Where should counters live?",
                oneOf: [
                  { const: "redis", title: "Redis", description: "Shared across instances" },
                  { const: "memory", title: "In memory", description: "Per instance, no new dependency" },
                ],
              },
            },
          },
        },
      ],
      entries: [
        { seq: 1, kind: "user", text: "Add rate limiting to every public route. Return 429 with a Retry-After header." },
        { seq: 2, kind: "agent", text: "I'll add a sliding-window limiter as middleware on the `/v1` router. Two decisions before I write it:" },
      ],
    },
    "t-docs": {
      configOptions: codexOpts(),
      entries: [
        { seq: 1, kind: "user", text: "Generate OpenAPI docs from the route definitions and serve them at /docs." },
        { seq: 2, kind: "tool_call", toolCallId: "d1", title: "Read src/routes/index.ts", status: "completed", data: { kind: "read" } },
        { seq: 3, kind: "agent", text: "Collecting the zod schemas for each route…" },
      ],
    },
  };
  return { projects, details };
}

export const git: GitStatus = {
  branch: "feat/dark-mode",
  ahead: 2,
  behind: 0,
  upstream: true,
  files: [
    { path: "src/screens/SettingsScreen.tsx", status: "modified", added: 4, removed: 1, staged: false },
    { path: "src/theme/ThemeProvider.tsx", status: "modified", added: 18, removed: 6, staged: false },
    { path: "src/settings/store.ts", status: "modified", added: 7, removed: 0, staged: false },
    { path: "src/theme/mocha.ts", status: "untracked", added: 42, removed: 0, staged: false },
  ],
};

export const diff = (file: string) =>
  `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1,6 +1,9 @@\n export function SettingsScreen() {\n-  const { notifications, setNotifications } = useSettings();\n+  const { notifications, setNotifications, theme, setTheme } = useSettings();\n   return (\n     <Screen title="Settings">\n+      <Row label="Appearance">\n+        <Segmented options={["System", "Light", "Dark"]} value={theme} onChange={setTheme} />\n+      </Row>\n`;

export const files = ["src/screens/SettingsScreen.tsx", "src/theme/ThemeProvider.tsx", "src/theme/latte.ts", "src/theme/mocha.ts", "src/settings/store.ts", "src/settings/", "src/components/Segmented.tsx", "README.md"];
