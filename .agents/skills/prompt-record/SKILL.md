---
name: prompt-record
description: Use when drafting or applying a PROMPTS.md feature record from the current Codex session.
---

# Prompt Record

Prepare an evidence-grounded `PROMPTS.md` section for one feature scope.

1. Require the scope and confirm it matches the current feature. Reserve `[planning]` for the planning review session.
2. Before drafting, inspect the immediately previous feature section. If its hash is missing, backfill only when exactly one commit reachable from `HEAD` has that scope: run `git show -s --format=%B <short-hash>`, then replace its planned-message/status block with the command's full subject and body under `- 메시지:` plus `- 해시: <short-hash>`. Otherwise report the ambiguity without guessing. Leave the current scope uncommitted until the next feature records it.
3. Require exactly one `PROMPT_LOG_SESSION_ID=<session_id>` from hook-provided developer context. If it is absent, duplicated, or invalid, stop without drafting.
4. From the repository root, run `node .agents/skills/prompt-record/scripts/read-prompt-log.mjs "<session_id>"` and read only its stdout. If it fails, stop. Never list, search, sort, or select another session log; side-conversation logs are out of scope regardless of timestamp.
5. Copy material user prompts from each `prompt` field verbatim; omit status checks and approval-only messages.
6. Derive `AI 출력 요지` from the actual assistant output and diff.
7. Record code review and commands only when they were actually inspected or run. Record manual verification only when the user reported the observation; otherwise write `미검증`.
8. Draft a current `- 예정 메시지:` as a complete commit message: one `type(scope): summary` subject and 2–4 evidence-grounded body bullets explaining what and why. Preview the complete current section and any previous-section 제목·본문·해시 backfill without editing files.
9. Apply only the approved preview after explicit user approval. Never commit.

Keep the existing `PROMPTS.md` template and scope-to-commit naming rules.
