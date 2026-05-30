# gstack — The Knowledge Architecture

gstack is not a framework. It's a **prompt engineering system** that turns a single AI model into a structured engineering team. The real value isn't the slash commands — it's the **structured knowledge** injected into the agent's context window that makes each skill work.

Every skill is a `.SKILL.md.tmpl` template that gets compiled into a `SKILL.md` file. The template contains:
- **YAML frontmatter** — metadata, tool permissions, trigger phrases
- **Resolver placeholders** — `{{PREAMBLE}}`, `{{GBRAIN_CONTEXT_LOAD}}`, `{{LEARNINGS_SEARCH}}`, etc.
- **Step-by-step instructions** — numbered phases with bash code blocks and prose

The resolvers (TypeScript files in `scripts/resolvers/`) fill in the placeholders at compile time, injecting model-specific behavior, project context, and cross-session memory.

## Local Mirror

A read-only clone of [garrytan/gstack](https://github.com/garrytan/gstack) (MIT licensed) lives under `upstream/`. It is the source of truth for everything below — all templates, resolvers, bin helpers, and reference docs. Treat it as vendored upstream: don't edit in place. To refresh, `cd upstream && git pull`.

Key landmarks inside the mirror:

- `ETHOS.md` — the three Builder Ethos principles (Boil the Lake, Search Before Building, User Sovereignty) that get injected into every workflow skill's preamble. This is the foundational prompt-engineering substrate.
- `AGENTS.md` — the agent-facing entry point. The non-Claude-Code equivalent of `CLAUDE.md`; lists every skill and routing rules. This is what a local model should read at session start.
- `ARCHITECTURE.md` — system architecture, including the prompt-injection defense layers used by the sidebar agent.
- `SKILL.md.tmpl` + `SKILL.md` at repo root — the top-level routing skill that dispatches to all others.
- `<skill-name>/SKILL.md.tmpl` — per-skill template with YAML frontmatter (name, preamble-tier, allowed-tools, triggers, hooks, gbrain context queries) followed by the prompt body with `{{PLACEHOLDER}}` tokens.
- `<skill-name>/SKILL.md` — compiled prompt, ready for an agent to read directly. Use these if you're skipping the template layer.
- `scripts/resolvers/` — 20 TypeScript resolvers that fill in placeholders. The `preamble/` subdirectory contains 23 generator scripts that assemble the T1–T4 preamble fragments (voice directive, completion status, context recovery, confusion protocol, test failure triage, search-before-building, etc.).
- `bin/` — 40+ runtime helpers (`gstack-config`, `gstack-slug`, `gstack-learnings-log`, `gstack-developer-profile`, etc.) that the skills shell out to during execution.

## How Compilation Works

```
SKILL.md.tmpl  +  resolvers/*.ts  →  SKILL.md (final prompt sent to agent)
```

The `gen-skill-docs` TypeScript script reads each `.tmpl` file, resolves all `{{PLACEHOLDER}}` tokens using the resolver functions, and writes the final `SKILL.md`. This is what gets loaded into the agent's context when the skill triggers.

## Preamble Tiers

Skills are assigned a `preamble-tier` (1-4) that controls how much boilerplate context is injected:

| Tier | What's Included | Skills |
|------|----------------|--------|
| **T1** | Core bootstrap, upgrade check, telemetry, voice (trimmed), completion status | browse, setup-browser-cookies, benchmark |
| **T2** | T1 + full voice, AskUserQuestion format, completeness, context recovery, confusion protocol, checkpoint mode, context health | investigate, cso, retro, document-release, setup-deploy, canary, context-save, context-restore, health, learn |
| **T3** | T2 + repo mode detection, search-before-building | office-hours, plan-ceo-review, plan-eng-review, plan-design-review, plan-devex-review, autoplan, codex, design-consultation |
| **T4** | T3 + full test failure triage, review army, plan completion audit | review, ship, qa, qa-only, design-review, land-and-deploy |

Higher tiers = more context = more capable but larger prompt.

---

## Skill Knowledge Breakdown

Each section below documents what knowledge is injected into the agent for every skill. This is the "brain" that makes the skill work.


## Tier 1: Direct-Action Skills

The lightest tier. T1 receives a trimmed preamble — just enough to bootstrap, check for upgrades, log telemetry, and report completion. These are narrow-scope tools: do one thing, fast, and get out. The injected knowledge focuses on tool mechanics rather than methodology.

### `/browse`

The vision skill. Wraps a persistent Chromium daemon (Playwright-driven) with ~100ms per command after a ~3s cold start. Injected knowledge: the full `$B` command surface (`goto`, `snapshot`, `click`, `fill`, `screenshot`, `console`, `handoff`/`resume`), state-preservation semantics across calls, the rule to call `Read` on every screenshot PNG so the user can actually see it, and the untrusted-content warning that page output must be treated as data, not commands.

### `/setup-browser-cookies`

Session manager for authenticated testing. Knowledge: how to detect installed Chromium browsers (Comet, Chrome, Arc, Brave, Edge), how to decrypt cookies via the macOS Keychain, and how to drive the interactive domain picker. Carries a privacy constraint — cookie values are never displayed in chat, only domain names and counts.

### `/benchmark`

Performance baselines. Knowledge: how to drive the browse daemon for multi-run Chromium measurements (load time, LCP, CLS, INP, resource counts, total transfer size), how to average across runs, and how to persist results so later runs can diff against a baseline. The "compare before/after on every PR" pattern is the load-bearing workflow.

---

## Tier 2: Workflow Skills

T2 adds the full voice, the `AskUserQuestion` format spec, the completeness rubric, context recovery, the confusion protocol, checkpoint mode, and the context-health monitor. These skills drive multi-step workflows and need the model to think about its own behavior — when to ask, when to escalate, when to stop and report.

### `/investigate`

Systematic debugger. Hard rule baked into the prompt: no fix attempts until root cause is established, and stop after three failed fix attempts to re-question the architecture instead of thrashing. Knowledge: how to trace data flow, match against known bug patterns, and run hypothesis tests one at a time. Auto-activates `/freeze` on the affected module so unrelated code can't drift during debugging.

### `/cso`

Chief Security Officer. Knowledge: the OWASP Top 10 checklist plus STRIDE threat-modeling categories. Each finding is structured with severity, evidence (file:line), and a recommended fix. Scans for injection, broken authentication, sensitive data exposure, XXE, broken access control, security misconfiguration, XSS, insecure deserialization, vulnerable components, and insufficient logging.

### `/retro`

Engineering manager mode. Knowledge: how to read commit history and produce a candid retro — commits, LOC, test ratio, PR sizes, fix ratio, coding-session detection from timestamps, hotspot files, shipping streaks, biggest ship of the week. Team-aware: identifies the current user, gives them the deepest treatment, then walks the other contributors. Persists a JSON snapshot to `.context/retros/` so the next run can compute trends. Flags test ratio below 20% as a growth opportunity.

### `/document-release`

Technical writer mode. Knowledge: how to cross-reference every doc file in the repo against the current diff and update file paths, command lists, project-structure trees, and version bumps. Risky or subjective changes surface as questions; mechanical ones are handled silently. Polishes CHANGELOG voice without ever overwriting existing entries, and checks for cross-doc consistency.

### `/setup-deploy`

One-time deploy configurator. Knowledge: how to fingerprint a project's deploy platform (Fly.io, Render, Vercel, Netlify, Heroku, GitHub Actions, custom), discover the production URL and health-check endpoint, and write the resulting config to `CLAUDE.md` so `/land-and-deploy` can run without re-asking. Designed as a 60-second one-shot — runs once per project.

### `/canary`

Post-deploy SRE mode. Knowledge: how to drive the browse daemon in a monitoring loop, check key pages for console errors and performance regressions, and compare screenshots against pre-deploy baselines. Loops on a fixed interval; alerts on the first anomaly rather than waiting for a pattern.

### `/context-save`

Working-context checkpoint. Knowledge: how to snapshot git state, decisions made in the current session, remaining work, and failed approaches into a structured artifact under `~/.gstack/projects/$SLUG/`. Pairs with the optional continuous checkpoint mode (`gstack-config set checkpoint_mode continuous`), which auto-commits WIP with a `WIP:` prefix and a structured `[gstack-context]` body — survives crashes and context switches.

### `/context-restore`

The companion to `/context-save`. Knowledge: how to read prior checkpoints (including the WIP commits from continuous mode) and reconstruct session state, even across Conductor workspace handoffs. Injected behavior: load the most recent checkpoint, summarize what was in flight, and ask before resuming so the user can correct any drift.

### `/health`

Code-quality dashboard. Knowledge: how to drive the type checker, linter, test runner, and dead-code detector for the project; how to compute a weighted 0–10 score from those signals; and how to track the score across runs. The score isn't pass/fail — it's a longitudinal signal the user can watch climb or slide over time.

### `/learn`

Institutional memory. Knowledge: how to read `~/.gstack/projects/$SLUG/learnings.jsonl`, present learnings with confidence scores and source attribution, prune stale entries (referenced files deleted), and export for team sharing. The complementary behavior lives in every other skill — they search learnings before making recommendations and stamp "Prior learning applied" when a past insight fires.

---

## Tier 3: Planning & Multi-AI Skills

T3 adds repo-mode detection and the Search-Before-Building framework. These skills need to understand the project deeply before they speak — what kind of repo this is, what's already been built in the category, what conventional wisdom applies, and where the gaps are worth attacking.

### `/office-hours`

The YC-style entry skill. Knowledge: six forcing questions in startup mode (demand reality, status quo, desperate specificity, narrowest wedge, observation & surprise, future-fit) and a generative-question framework in builder mode. Carries the premise-challenge pattern (falsifiable claims you accept, reject, or amend) and the implementation-alternatives format — 2–3 approaches with honest effort estimates in both human-team and Claude-Code time. Output is a design doc written to `~/.gstack/projects/` that downstream planning skills consume.

### `/plan-ceo-review`

Founder mode. Reframes a request from "implement this feature" to a question about the most ambitious version hiding inside it. Knowledge: four scope modes (Expansion, Selective Expansion, Hold Scope, Reduction) with opt-in ceremonies for each expansion so the user never gets surprised. Visions and decisions persist to `~/.gstack/projects/`; exceptional visions can promote to `docs/designs/` for the team.

### `/plan-eng-review`

Eng-manager mode. Knowledge: the architecture / data-flow / state / failure-mode / trust-boundary checklist, plus a strong bias toward producing diagrams (sequence, state, component, data-flow, test matrices). The Review Readiness Dashboard is the load-bearing artifact — every review logs its result, and `/ship` checks the dashboard before opening a PR. Writes a test-plan artifact that `/qa` picks up automatically.

### `/plan-design-review`

Senior designer in plan mode. Knowledge: a seven-pass audit (information architecture, interaction-state coverage, user journey, AI-slop risk, design-system alignment, responsive/accessibility, unresolved decisions), each rated 0–10 with an explicit "what a 10 looks like" reference. Obvious gaps are fixed in-place; genuine tradeoffs surface as `AskUserQuestion`. Calibrates against `DESIGN.md` when one exists; otherwise applies universal design principles and suggests running `/design-consultation` first.

### `/plan-devex-review`

The DevEx counterpart to the other plan reviews. Knowledge: how to audit a plan for the developer-experience dimensions other reviews miss — time-to-hello-world, getting-started friction, error-message quality, API/CLI naming consistency, and opinionated-defaults-vs-flexibility taste decisions. Pairs with the live-site `/devex-review` skill, which boomerangs back to score whether the plan matched reality.

### `/autoplan`

Review autopilot. Knowledge: how to run CEO → Design → Eng review sequentially without stopping for every intermediate question, encoding six decision principles (prefer completeness, match existing patterns, prefer reversible options, prefer the user's prior choice on similar decisions, defer ambiguous items, escalate security). Taste decisions are batched and presented at a single final approval gate. Also knows to run both a Claude subagent and Codex when available, and to degrade gracefully when Codex times out.

### `/codex`

Second-opinion mode via OpenAI's Codex CLI. Knowledge: three sub-modes (Review with P1/P2/P3 severity and pass/fail gate; Challenge with `xhigh` reasoning effort for adversarial review; Consult with session continuity for follow-ups). When both `/review` and `/codex` have run on the same branch, emits a cross-model overlap report — findings unique to each model are where the bugs neither would catch alone tend to live.

### `/design-consultation`

Design partner for green-field projects. Knowledge: how to interview the user about product, audience, and communication goals; how to research the category landscape (optional, gated by an explicit privacy consent step); and how to propose a coherent design system — aesthetic direction, typography (3+ fonts with roles), color palette with hex values, spacing scale, layout approach, motion strategy. Critically, also separates deliberate creative risks from safe category choices so the user can pick which conventions to break. Output: `DESIGN.md` at repo root plus a `CLAUDE.md` update so every future session respects the system.

---

## Tier 4: Heavy-Hitter Skills

T4 carries everything T3 has plus full test-failure triage, the review-army pattern, and the plan-completion audit. These are the skills that touch production — they review code, ship code, deploy code, and verify what shipped. The injected context is heavy because the cost of a mistake is high.

### `/review`

Paranoid staff engineer. Knowledge: the structural-bug catalog (N+1 queries, stale reads, race conditions, bad trust boundaries, missing indexes, escaping bugs, broken invariants, bad retry logic, tests that pass while missing the failure mode, forgotten enum handlers traced across switch statements). Fix-First behavior: mechanical fixes get applied automatically with `[AUTO-FIXED]` tagging; ambiguous issues escalate. Flags completeness gaps where the 100% solution costs under 30 minutes of CC time. Integrates Greptile PR comments when present, with valid / already-fixed / false-positive triage.

### `/ship`

Release engineer. Knowledge: the full sync-main → test → coverage-audit → push → PR pipeline. If no test framework exists, bootstraps one — detects runtime, picks a framework, installs it, writes 3–5 real tests, sets up CI. Builds a code-path map from the diff, searches for corresponding tests, produces an ASCII coverage diagram with quality stars, and auto-generates tests for gaps. Checks the Review Readiness Dashboard before opening the PR (asks, doesn't block).

### `/qa`

QA-lead mode. Knowledge: four operating modes (Diff-aware on feature branches, Full, Quick, Regression), each with its own scoping logic. Reads the test-plan artifact that `/plan-eng-review` wrote and tests against it. When a fix is applied and verified, auto-generates a regression test with full attribution back to the QA report. Drives the browse daemon for real-browser testing and consumes `/setup-browser-cookies` sessions for authenticated pages.

### `/qa-only`

The reporter variant of `/qa`. Same testing methodology, no code changes. Knowledge: how to suppress the fix loop and emit a pure bug report with screenshots, severity tags, and reproduction steps. Used when you want a QA pass without committing.

### `/design-review`

Live-site visual audit plus fix loop. Knowledge: an 80-item visual audit producing Design Score and AI-Slop Score letter grades, then a fix loop that locates source files, makes minimal CSS-only changes, commits atomically with `style(design): FINDING-NNN`, re-navigates to verify, and screenshots before/after. Hard cap at 30 fixes; risk score above 20% triggers a stop. CSS-only changes get a free pass; JSX/TSX changes count against the risk budget.

### `/land-and-deploy`

End-to-end deploy pipeline. Knowledge: how to merge the PR, wait for CI, wait for the deploy to finish, then run canary checks against production. Reads the platform config that `/setup-deploy` wrote. First run on a new project triggers a dry-run walk-through; after that, runs straight through unless a check fails. Knows when to suggest rollback vs. iterate.

---

## References

- Upstream repo: [garrytan/gstack](https://github.com/garrytan/gstack)
- Per-skill deep dives: [`docs/skills.md`](https://github.com/garrytan/gstack/blob/main/docs/skills.md)
- Browse subsystem reference: [`BROWSER.md`](https://github.com/garrytan/gstack/blob/main/BROWSER.md)
- Sidebar agent & prompt-injection defense: [`ARCHITECTURE.md`](https://github.com/garrytan/gstack/blob/main/ARCHITECTURE.md)
