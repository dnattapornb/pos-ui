---
name: git-conventional-commit-message
description: Use when the user asks for a git commit message, title, subject, or help choosing commit type/scope. Standardizes messages to Conventional Commits `<type>(<scope>): <subject>`, with an optional body when useful.
---

# Git Conventional Commit Message

When generating or reviewing a commit message, you MUST follow the rules below. Keep the commit message itself in **English**; explain your choices to the user in **Thai**.

## 1. Format

```text
<type>(<scope>): <subject>
```

Add a body ONLY when the change needs context not obvious from the subject:

```text
<type>(<scope>): <subject>

<why / what changed, 1-3 concise lines>
```

## 2. Type Selection

| Type | Use for |
|---|---|
| `feat` | New behavior, model, endpoint, store, component, bridge, or user-visible feature |
| `fix` | Bug fix, regression, incorrect behavior, broken test expectation |
| `refactor` | Internal restructuring with NO intended behavior change |
| `test` | Test-only changes, fixtures, or test helpers |
| `chore` | Maintenance, tooling, config, dependency updates, ignored agent/skill files |
| `docs` | Documentation-only changes |
| `style` | Formatting-only changes with no behavior impact |

Prefer `feat` over `feature` unless the repository explicitly requires `feature`.

## 3. Scope Selection

Pick a short lowercase scope from the changed area:

- **OCR / Parsing:** `ocr`, `gemini`, `vision`
- **LINE / Webhook:** `line`, `webhook`, `flex`
- **Database / Entities:** `db`, `typeorm`, `receipt`
- **Tooling / config:** `docker`, `jest`, `agents`

If the change spans unrelated areas, omit the scope or choose the highest-level shared scope.

## 4. Subject Rules

- Use imperative present tense: `add`, `fix`, `split`, `normalize`, `update`.
- Keep under ~72 characters when practical.
- Lowercase after the colon unless a proper noun or acronym requires otherwise.
- NEVER end the subject with a period.
- Name the concrete artifact or behavior, not implementation noise.

## 5. Body Rules

Include a body when it clarifies: why the change was made, compatibility/migration notes, behavior kept untouched, or validation added/changed. NEVER include routine command output unless the user asks.

## 6. Examples

```text
feat(line): add flex message builder for receipt approval
```

```text
fix(ocr): strip markdown fences from gemini response

Gemini occasionally wraps JSON output in ```json fences,
which broke the JSON.parse function.
```

```text
refactor(db): migrate mongoose schemas to typeorm entities
```

```text
test(ocr): cover missing gemini api key gracefully
```

```text
chore(agents): add git-conventional-commit-message skill
```

## 7. Response Style

When the user asks for one commit message, return one recommended message first. Add alternatives ONLY if the type or scope is ambiguous.
