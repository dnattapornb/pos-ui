# AGENTS.md (System Instructions)

> **Golden Rule:** Always output explanations, summaries, and step-by-step thinking in **Thai**. Keep all code, variables, file paths, commands, and technical terms in **English**.

## 1. Project Context

- **Project:** LINE Receipt OCR API (`pos-api`)
- **Purpose:** A NestJS REST API acting as a LINE Webhook Receiver to process receipt images sent by users via LINE Chat, extract data using OCR and AI, and reply with an interactive Flex Message.
- **Tech Stack:** Node.js 22+, NestJS 11 (TypeScript Strict), Google Cloud Vision API (`@google-cloud/vision`), Google Gemini 2.0 Flash (`@google/generative-ai`), LINE Messaging API v3 (`@line/bot-sdk`), MySQL 8 (TypeORM), Redis (`ioredis`).

## 2. Global Inviolable Rules

1. **HMAC Signature Validation:** Every incoming Webhook from LINE **MUST** be validated using HMAC-SHA256. `rawBody` is mandatory for this validation.
2. **Never Throw on Webhooks:** Always catch errors and return `{ status: 'success' }` (HTTP 200). Returning errors (e.g., 401 or 500) will cause LINE to endlessly retry.
3. **Strict TypeScript:** No `any` types except where the LINE SDK forces it (e.g., WebhookEvent subtypes).
4. **Timezone Policy (Critical):** All `DATETIME` columns are stored and read as **Asia/Bangkok (+07:00)** Thai local time. The TypeORM driver and MySQL server are both pinned to `+07:00`. Never convert to UTC before saving to the DB.
5. **Caching & Performance:** Product barcode lookups MUST use the Redis Cache-Aside pattern (`pos:barcode:{barcode}`). Inventory quantities must ALWAYS be queried live from MySQL (Hybrid Stock pattern).
6. **Gemini Model:** MUST always use `"gemini-2.5-flash"` (as currently configured in the code). Do not use other models to prevent 404/compatibility errors.
7. **Tests:** **MUST** add/update a test for every changed service, controller, or helper. Place each `*.spec.ts` in the centralized test directory `test/unit/`, mirroring the source path.

## 3. Skill & Reference Routing

Do not guess. Read the specific file when doing related work:

- **Architecture & API Design:** `.agents/specs/design.md`
- **Database Schema (tables/columns/relations):** `.agents/specs/database.md`
- **POS REST API (curl/test config):** `.agents/references/pos-api.md` (Runnable client: `http/pos.http`)
- **Naming Conventions:** `.agents/references/naming-conventions.md`
- **Git Commit Rules:** `.agents/skills/git-conventional-commit-message/SKILL.md`
- **Unit Test Patterns (ESLint safe):** `.agents/skills/nestjs-unit-test/SKILL.md`
- **Current Tasks:** ALWAYS check the latest dated folder under `.agents/specs/tasks/*/tasks.md` for the active phase.

## 4. Repository Gotchas

- **Environment Variables:** `PORT`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `GOOGLE_APPLICATION_CREDENTIALS`, `GEMINI_API_KEY`, `LIFF_EDIT_URL`, `REDIS_HOST` are required for full functionality.
- **Graceful Boot:** The application MUST start even if `GEMINI_API_KEY` or Redis is missing/unreachable. Handle failures per-request, not at bootstrap.
- **Price Calculations:** Always explicitly cast extracted decimal amounts using `Number()`, never `parseInt/parseFloat` to avoid string edge cases from MySQL decimals.
- **Soft Deletes:** Deleting products or units uses a `published = false` flag. Never hard-delete unless explicitly instructed (like Categories/Suppliers).

## 5. Workflow & Output Standard

- **Thinking:** Before writing or modifying code, **ALWAYS** open a `<thinking>` block to analyze the impact.
- **Smallest change:** Edit the fewest files; add the narrowest test first; run targeted test + file-scoped lint; review the diff for accidental contract changes before declaring ready.
- **Type Safety Check:** Before declaring a major refactor or change ready, you **MUST** run `npm run build` or `npx tsc --noEmit` to verify type safety across the entire project. Unit tests alone might skip un-tested files.
- **Task Tracking:** After completing each sub-task in a phase, **MUST** update the corresponding checkbox in `.agents/specs/tasks/*/tasks.md` from `[ ]` to `[x]`. This is not optional — do it immediately after verification passes.
- **Commit Message:** At the end of **every unit of completed work** — whether a full phase (e.g. all of R1.1–R1.7) or a single sub-task done in its own session (e.g. only R1.3) — you **MUST** output a ready-to-use git commit message. This is mandatory, not optional. Rules:
  - Format **MUST** follow the `git-conventional-commit-message` skill (`<type>(<scope>): <subject>` + optional body). Read that skill before writing the message.
  - Base the message on the **actual `git diff`** of the completed work, not on assumptions.
  - Keep refactor and behavior changes in **separate commits** (AGENTS.md rule 4). One logical unit = one commit message.
  - Do **NOT** run `git commit` yourself unless the human explicitly asks — only present the message for review.
- **Session Management:** After completing a phase, **STOP** for human review. Remind the human to start a **new session** before the next phase to clear the context window. The commit message above **MUST** be presented before stopping.
