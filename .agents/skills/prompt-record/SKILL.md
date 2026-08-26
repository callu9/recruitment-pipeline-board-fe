---
name: prompt-record
description: Use when user validation is complete and feature evidence is ready to record, or submission review needs pending commit hashes synchronized.
---

# Prompt Record

Keep feature evidence current without mixing prior-scope maintenance into feature commits.

## Feature record mode

Run this mode automatically only after the user reports validation results or explicitly accepts the unverified scope, and before staging.

1. Require the scope and confirm it matches the current feature. Reserve `[planning]` for the planning review session.
2. Require exactly one `PROMPT_LOG_SESSION_ID=<session_id>` from hook-provided developer context. If it is absent, duplicated, or invalid, stop without drafting.
3. From the repository root, run `node .agents/skills/prompt-record/scripts/read-prompt-log.mjs "<session_id>"` and read only its stdout. If it fails, stop. Never list, search, sort, or select another session log; side-conversation logs are out of scope regardless of timestamp.
4. Copy material user prompts from each `prompt` field verbatim; omit status checks and approval-only messages.
5. If validation requires code changes, stop without writing the record and return to automated verification and the unstaged candidate report.
6. Derive `AI 출력 요지` from the actual assistant output and stable diff. Record review and commands only when actually inspected or run. Copy user-reported validation faithfully; write `미검증` only when the user explicitly accepts it.
7. Insert or update only the current scope's section. Preserve existing user-authored judgments and do not modify any other feature section.
8. Write `- 예정 메시지:` with one `type(scope): summary` subject and 2–4 evidence-grounded body bullets, followed by `- 해시: 최종 동기화 대기`.
9. Apply the record, run the focused prompt contract test and `git diff --check`, then stage the current scope. The user reviews the staged diff before any commit. Never commit.

## Final hash sync mode

Run this mode only during `[submission-review]`.

1. Find every earlier feature section whose hash is missing or marked `최종 동기화 대기`; ignore the template and the uncommitted current `[submission-review]` section.
2. For each record, require exactly one commit reachable from `HEAD` whose subject equals the planned commit subject and whose scope equals the section scope. Read its full subject and body with `git show -s --format=%B <short-hash>`.
3. If any planned subject and scope pair has no unique commit, stop and report all ambiguities without changing `PROMPTS.md`.
4. In one diff, replace every resolved planned-message block with `- 메시지:` containing the full commit message and `- 해시: <short-hash>`.
5. Do not change feature prose, verification claims, or code. Never commit.

Keep the existing `PROMPTS.md` template and scope-to-commit naming rules.
