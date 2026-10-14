# Workspace Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved work-first recruitment preview and document every audit change in a permanent HTML report.

**Architecture:** Pure selectors choose the next incomplete work; existing API transforms and stage policies remain authoritative. A nonmodal desktop list/detail split uses native dialog semantics with mobile detail navigation. Mounted hidden panes preserve input drafts; intake uses a modal over existing forms.

**Tech Stack:** React 19, TypeScript, TanStack Query, MSW, native dialog, existing shadcn controls.

**Spec:** docs/PRD.md (FR-02/04/07, UX-04/05/06), docs/TECH_SPEC.md, approved preview5175, audit R01/R02/R03/R05.

## Global Constraints
- Preserve existing repo branch and user files; no new worktree, merge, deployment, authorization roles, backend service or dependencies.
- Keep entity rollback, synchronous same-applicant pending guard, stage validation and explicit overrides.
- Keep URL selection/filters/pagination, Back/Forward, session drafts and focus restoration.
- Use synthetic isolated browser data; clearly label mock API and static preview.
- Current prompt hook is unavailable; do not fabricate a session or reuse prior manual exception.

## Review Focus
- Paused, archived and terminal records must open useful support work without implying allowed stage progression.
- Concurrent saves for distinct applicants remain isolated; same applicant actions disabled.
- Pane changes and selection changes preserve drafts; quota failures require explicit discard.
- Nested confirmation Escape must not also close detail; close restores originating controls.
- Mobile split must not cause page overflow or make detail unreachable.

### Task 1: Work-aware actions
**Files:** Create model/applicantWork.ts and tests; modify ApplicantsView.tsx, App.tsx.
**Interfaces:** getApplicantWork(applicant, today): {label,target,dueDate?,reason}; ApplicantWorkTarget union of existing form titles plus evaluation/progress.
- [x] Add failing selector tests for active evaluations, missing schedule, offer, start, followup, inactive/archive.
- [x] Run focused test and observe missing-module failure.
- [x] Implement pure selector using existing predicates; connect list/Today primary action to actual form target; stage actions become secondary.
- [x] Run selector and workflow regression tests.

### Task 2: Work-first list and detail
**Files:** App.tsx, App.module.css, ApplicantOperations.tsx, App.workflow.test.tsx, App.test.tsx.
**Interfaces:** selected work request opens/focuses the relevant mounted pane/form; support actions remain mounted under support pane.
- [x] Add failing workflow cases: work CTA input focus, support separation, pane draft preservation, intake modal/close focus, blocked selection on quota error.
- [x] Implement nonmodal desktop split, mobile focused detail, work/support/history navigation; preserve native confirmation and portal behavior.
- [x] Move intake to title-side button/native modal; preserve creation/import forms and drafts.
- [x] Add explicit navigation count units and queue unit explanation without changing counts/policies.
- [x] Run lint, full test, build; resolve failures with meaningful regression coverage.

### Task 3: Browser verification, review and report
**Files:** docs/reviews/2026-10-08-workspace-workflow.html; current-scope DECISIONS/PROMPTS only after record gate.
- [x] Capture actual desktop/mobile before/after and test input/error/loading/empty/confirmation/toast/focus/history/pending/rollback.
- [x] Request independent read-only code review and resolve material regressions.
- [x] Build self-contained HTML with all 14 audit statuses, before/after rationale, role/screen flows, embedded actual synthetic screenshots and verification limits.
- [x] Resolve prompt-record current scope with newly authorized explicit exception on 2026-10-10; actual transcript is in PROMPTS, contract test and diff check follow before staging.
- [ ] Stage scoped files only; authorized commit/push to PR12, update PR description and verify latest SHA CI; never merge/deploy.

## Actual verification

- Final lint,15files264tests,build,diff check passed. Chrome42checks passed in isolated synthetic profile. Independent reviewer4findings reproduced with failing tests and fixed; reviewer confirmed close/Back intake pending and inactive notification after followup.
- 2026-10-08 report snapshot: record/publication remained pending without a hook-provided PROMPT_LOG_SESSION_ID. No fake hook or prior exception reuse occurred.
- 2026-10-10: user explicitly approved the current-scope manual record exception. Fresh lint/264tests/build/5contract tests/diff passed before recording. Only publication and the latest remote SHA CI remain to be completed and reported in PR12.
