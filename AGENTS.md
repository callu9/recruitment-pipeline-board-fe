# AGENTS.md

## Project objective

Build a recruitment pipeline board that demonstrates responsible AI-assisted frontend development. The repository history and `PROMPTS.md` must show one feature at a time, with genuine review and verification.

## Required reading order

Before any change, read:

1. `docs/ASSIGNMENT.md`
2. `docs/PRD.md`
3. `docs/TECH_SPEC.md`
4. `docs/IMPLEMENTATION_AND_COMMIT_PLAN.md`
5. the current feature section in `PROMPTS.md`
6. relevant recent commits and existing code

## Working agreement

- Work on exactly one named feature scope at a time.
- Before editing, state the requirement IDs, planned files, algorithm, and verification scenarios.
- Do not modify unrelated files or silently refactor neighboring code.
- Prefer the smallest implementation that meets the current acceptance criteria.
- Do not start a Should feature before all Must criteria are stable.
- Do not commit until the user has reviewed the diff and explicitly requests a commit.
- Never squash, amend away meaningful history, rebase published history, or force-push.
- Never fabricate commands, test output, browser verification, or AI review findings.
- Do not claim a requirement is satisfied merely because code exists; show how it was verified.

## Architecture constraints

- Use React + TypeScript with Vite.
- Use TanStack Query cache as the source of truth for applicants.
- Use MSW + `localStorage` for the mock API and persistence.
- Simulate 200–800ms latency and approximately 15% failure.
- Use explicit stage selection and a move button, not drag and drop.
- Do not add Zustand or another global store unless a concrete requirement cannot be met without it.
- Do not restore a full applicant-list snapshot on move failure. Roll back only the failed applicant entity.
- Prevent overlapping moves for the same applicant with a synchronous pending guard; allow different applicants to move concurrently.
- Keep domain transforms in pure functions and test them.
- Use semantic HTML and ensure keyboard access.

## AI record constraints

- The user will provide or preserve the actual prompt text.
- Do not rewrite `PROMPTS.md` as though the user verified something they did not verify.
- You may propose an `AI 출력 요지`, but the user owns the final `리뷰 / 검증` text.
- Each feature commit must include its corresponding `PROMPTS.md` section.
- Use the same scope name in the prompt heading and commit message, for example `[stage-move]` and `feat(stage-move): ...`.
- Any important assumption, adopted proposal, rejected proposal, or unfinished scope belongs in `DECISIONS.md`.

## Verification before requesting a commit

Run and report the actual result of:

```bash
npm run lint
npm run test
npm run build
```

Also report:

- changed files
- manual browser scenarios performed
- acceptance criteria satisfied
- known limitations
- any AI-generated code that was rejected or rewritten and why

Stop after reporting. Wait for explicit commit instructions.
