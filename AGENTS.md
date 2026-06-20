# AGENTS.md (System Instructions)

> **Golden Rule:** Always output explanations, summaries, and step-by-step thinking in **Thai**. Keep all code, variables, file paths, commands, and technical terms in **English**.

## 1. Project Context

- **Project:** LINE Receipt OCR API (`line-receipt-ocr-api`)
- **Purpose:** A NestJS REST API acting as a LINE Webhook Receiver to process receipt images sent by users via LINE Chat, extract data using OCR and AI, and reply with an interactive Flex Message.
- **Tech Stack:** Node.js 22+, NestJS 11 (TypeScript Strict), Google Cloud Vision API (`@google-cloud/vision`), Google Gemini 2.0 Flash (`@google/generative-ai`), LINE Messaging API v3 (`@line/bot-sdk`), MySQL 8 (TypeORM), Redis.

## 2. Global Inviolable Rules

1. **HMAC Signature Validation:** Every incoming Webhook from LINE **MUST** be validated using HMAC-SHA256. `rawBody` is mandatory for this validation.
2. **Never Throw on Webhooks:** Always catch errors and return `{ status: 'success' }` (HTTP 200). Returning errors (e.g. 401 or 500) will cause LINE to endlessly retry.
3. **Strict TypeScript:** No `any` types except where the LINE SDK forces it (e.g. WebhookEvent subtypes).
4. **Gemini Model:** MUST always use `"gemini-2.0-flash"`. Do not use other models to prevent 404 errors.
5. **Database:** Use MySQL 8 via TypeORM. The previous MongoDB implementation is being migrated out.
6. **Tests:** **MUST** add/update a test for every changed service, controller, or helper. Place each `*.spec.ts` in the centralized test directory `test/unit/`, mirroring the source path (e.g. `src/line/line.service.ts` → `test/unit/line/line.service.spec.ts`). Do not place `.spec.ts` files alongside source files.

## 3. Skill & Reference Routing

Do not guess. Read the specific file when doing related work:

- **Architecture & API Design:** `.agents/specs/design.md`
- **Database Schema (tables/columns/relations):** `.agents/specs/database.md`
- **POS REST API (Product & Inventory endpoints, curl/test):** `.agents/references/pos-api.md`
- **Naming Conventions:** `.agents/references/naming-conventions.md`
- **Git Commit Rules:** `.agents/skills/git-conventional-commit-message/SKILL.md`
- **Frontend Integration:** `../liff-receipt-frontend/MASTER_AGENT_PROMPT.md`
- **Current Tasks:** ALWAYS check the latest dated folder under `.agents/specs/tasks/*/tasks.md` for the active phase.

## 4. Repository Gotchas

- **Environment Variables:** `PORT`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `GOOGLE_APPLICATION_CREDENTIALS`, `GEMINI_API_KEY`, `LIFF_EDIT_URL` are required.
- **Graceful Boot:** The application MUST start even if `GEMINI_API_KEY` is missing (throw per-request instead of at bootstrap).
- **Price Calculations:** Always explicitly cast extracted amounts using `Number()`, never `parseInt/parseFloat` to avoid string edge cases.

## 5. Workflow & Output Standard

- **Thinking:** Before writing or modifying code, **ALWAYS** open `<thinking>` to analyze the impact.
- **Smallest change:** Edit the fewest files; add the narrowest test first; run targeted test + file-scoped lint; review the diff for accidental contract changes before declaring ready.
- **Type Safety Check:** Before declaring a major refactor or change ready, you **MUST** run `npm run build` or `npx tsc --noEmit` to verify type safety across the entire project. Unit tests alone might skip un-tested files.
- **Task Tracking:** After completing each sub-task in a phase, **MUST** update the corresponding checkbox in `.agents/specs/tasks/*/tasks.md` from `[ ]` to `[x]`. This is not optional — do it immediately after verification passes.
- **Commit Message:** At the end of **every unit of completed work** — whether a full phase (e.g. all of R1.1–R1.7) or a single sub-task done in its own session (e.g. only R1.3) — you **MUST** output a ready-to-use git commit message. This is mandatory, not optional. Rules:
  - Format **MUST** follow the `git-conventional-commit-message` skill (`<type>(<scope>): <subject>` + optional body). Read that skill before writing the message.
  - Base the message on the **actual `git diff`** of the completed work, not on assumptions.
  - Keep refactor and behavior changes in **separate commits** (AGENTS.md rule 4). One logical unit = one commit message.
  - Do **NOT** run `git commit` yourself unless the human explicitly asks — only present the message for review.
- **Session Management:** After completing a phase, **STOP** for human review. Remind the human to start a **new session** before the next phase to clear the context window. The commit message above **MUST** be presented before stopping.
