# Applicants workspace UX implementation plan

> Execution: superpowers:executing-plans, directly in this session. User validation and explicit commit gates in AGENTS.md take precedence over skill commit steps.

**Scope:** `applicants-workspace-ux`, explicitly expanded by the user from the uncommitted pagination candidate. Branch feat/applicants-pagination is retained.

**Goal:** A compact Applicants workspace with filter/sort/pagination, row detail entry and non-displacing per-applicant Sonner results.

**Spec:** `docs/superpowers/specs/2026-10-07-workspace-uiux-improvement-design.md`, §3 and §4 (UI-01~03, PAG-01~12).

**Layout:** Page size, full result count and visible range sit below stage filters, before the first table row. Previous/next and current page stay below the table. Both controls are outside the horizontal table scroll.

**Next priority:** After this scope passes its existing validation/record/staging/explicit commit gates, execute stage-scheduling (SFI-02~04/UX-07) before remaining detail/Calendar polish. Current model mapping and concrete work are prepared in the integrated spec §6.1; no scheduling implementation is included here.

**Architecture:** App owns filters, page and page size across tab switches. A pure selector slices the filtered list and clamps the page. Only ApplicantsView moves out of App; existing detail and mutation ownership remain.

**Constraints:** React/TypeScript/Vite base and Vitest configuration preserved; MSW/localStorage, 200–800ms and 15% default failure unchanged; entity rollback and synchronous same-ID guard retained. shadcn Radix components from one recorded CLI version, Tailwind v4 and @shadcn/lint only. server pagination, global store or table engine.

## Review focus

- A removed focused row falls back to the applicants heading without stealing focus from an open modal or another control.
- A vanished last page stays clamped after failed mutation restores its applicant.
- Pagination never refetches or copies applicants into UI state.
- Tailwind preflight preserves typography and centered native confirmation dialogs on other tabs.
- Same-size filter changes reset the page; tab switches preserve page and page size.

## Task 1: Pure pagination

- Files: workspaceSelectors.ts and workspaceSelectors.test.ts.
- [x] Add failing tests for 0/1/20/21/240, 20/50/100 sizes, bounded pages, ID completeness and immutable source.
- [x] Run focused selector tests and confirm missing paginateApplicants failure.
- [x] Implement `ApplicantPageSize = 20 | 50 | 100` and `paginateApplicants(applicants, page, pageSize)` returning items/page/totalPages/total/from/to using clamp and slice.
- [x] Rerun focused tests.

## Task 2: shadcn foundation and Applicants integration

- Files: package.json/lock, components.json, eslint.config.js, vite.config.ts, tsconfig.json/tsconfig.app.json, index.css, components/ui/{button,pagination,native-select,table,badge}.tsx; App.tsx, ApplicantsView.tsx, App.test.tsx and dead Applicants CSS only.
- [x] Add failing interaction tests for pagination, all filter resets, tab/position navigation, zero/one results, no GET/storage changes, last-page rollback, concurrent moves/guard and focus recovery.
- [x] Confirm expected failures before integration.
- [x] Configure Tailwind and alias, record CLI version, init Radix and add only required components; preserve original CSS tokens.
- [x] Register six design rules on new UI paths; disable only documented component-definition rules. Verify temporary violating fixture fails by rule ID and remove it.
- [x] Extract ApplicantsView, use Table/Badge/Button/NativeSelect/Pagination; App stores page/size and resets at existing filter/position events. Clamp page during render before children render. Detail remains selected from full cache.
- [x] Add explicit navigation focus/scroll and modal-safe disconnected-trigger fallback. Keep select/input focus.
- [x] Run focused tests/lint, then lint/test/build/diff check.

## Task 3: Candidate verification and user gate

- Files: PRD.md and TECH_SPEC.md relevant clauses; decisions only for adopted assumptions or exceptions.
- [x] Browser: 1440/768/390px, first/middle/last and size, filters/empty, keyboard/select/header focus, detail/action overlays, all other tabs and body overflow.
- [x] Review unstaged changes against every current-scope acceptance criterion; address material findings and rerun affected verification.
- [x] Report candidate, exact checks, limitations and manual validation scenarios here and to the originating chat. Stop for user validation.
- [ ] Only after validation: prompt-record current scope, record contract test and diff check, stage current scope and report staged diff. Commit only on explicit request.

## Initial candidate evidence (2026-10-07)

- Initial code verification: `npm run lint` passed without warnings; `npm run test` passed 9 files / 136 tests; `npm run build` passed with the existing >500 kB chunk warning (current JS 731.94 kB).
- Six shadcn rule IDs rejected temporary violations with nonzero exit; both fixtures were removed. New product UI and component definitions are checked, with only the three documented definition exceptions.
- Browser: 1440/768/390px pagination, 20/50/100, last-page 40 rows, title focus/scroll, keyboard detail/confirmation Escape restoration, tab state preservation, Positions reset, filtered empty pager hiding and refresh to 20. Body overflow stayed within viewport; small-screen controls measured 44px.
- Browser used existing localStorage data and a local `VITE_MOCK_FAILURE_RATE=0` override. Forced failures, entity rollback, concurrent cross-page moves, same-ID guard and no extra GET/storage changes were verified by automated tests, not live browser failures. Default 15% mock behavior is unchanged; deployment/CI and screen-reader speech were not exercised.
- Independent review found that CSS cleanup removed Calendar select borders/padding. Restored the original rule, verified computed 1px border / 0px 9px padding in the browser and reran the full suite. Removed unused generated dependencies/helper/exports; retained shared stage actions rather than duplicate them.
- Scope diff check passed with pre-existing unrelated AGENTS.md excluded. Whole-workspace `git diff --check` reports its pre-existing trailing blank line. Nothing is staged; PROMPTS.md and user validation remain pending.

## User feedback revision (2026-10-07) — validation pending

- User feedback rejected the bottom display-size placement and exposed the unfinished interview scheduling flow. It is not approval of the current candidate.
- Move page size, search result total and visible range above the table; keep navigation below. Add a failing DOM-order regression test, then rerun lint/test/build and desktop/390px/keyboard browser checks.
- Change integrated spec PAG-02/PAG-07, PRD/TECH_SPEC, implementation priority and DECISIONS consistently. Prepare stage-scheduling against actual read-only schedule, feedback hook, mutation guard, mock storage migration and selectors. Do not implement another feature before the current gate passes.

### Revised candidate evidence

- DOM-order regression failed before the move and passed after it. Empty-result count regression failed during review and was corrected: `검색 결과 0명` stays above the empty state while size/range/pager are hidden.
- Final `npm run lint` passed without warnings; `npm run test` passed 9 files / 137 tests in 13.65s; `npm run build` passed (JS 732.05 kB; existing >500 kB warning remains). Current-scope diff check passed; pre-existing AGENTS.md trailing blank line is still excluded. Nothing is staged.
- Full-suite and independent review runs exposed 5s timeouts in the 12-page traversal and 50/100-row cases. Kept all assertions, scoped pager queries to navigation, queried table detail buttons once per page, and set a bounded 10s timeout only on these intentionally large traversal cases. The default timeout is unchanged; these checks are correctness checks, not application performance measurements.
- Browser 1440x900: stage filters precede size/result/range, which precede the table (select bottom 641.5, table top 654.5); desktop size height 36px. Tab from size reaches the first applicant detail control.
- Browser 390x844: size height 44px, range wraps above the table, body width 375px within viewport 390px. Native keyboard Space/Down/Return selects 50 and 100, retains select focus and resets page to one. Enter on next moves to page two and focuses applicants-heading; 100-size last page has 40 rows and disabled next.
- Desktop/mobile screenshots saved as applicants-pagination-top-desktop.jpg and applicants-pagination-top-mobile.jpg. Browser console errors: none. Existing localStorage was preserved; the development failure-rate override remains 0, and actual deployment/screen-reader speech were not tested.
- Independent delta review found no additional material product/doc defect; its traversal timeout finding was addressed as above. Stage scheduling remains prepared only, and user validation/record/staging/explicit commit gates remain pending.

## Approved workspace expansion — implementation plan

- Product approval is not final validation, staging or commit approval. Current scope includes prior pagination plus UX-01 filter/sort, Applicants readability, Korean navigation, toast result delivery and row detail entry. Scheduling API/model writes stay next priority.
- Files: App.tsx/App.module.css/App.test.tsx; ApplicantsView.tsx; workspaceSelectors.ts/tests; generated ui input/collapsible/dropdown-menu/sonner plus package lock; a small toast host component if native top layer requires it; current PRD/TECH_SPEC/implementation plan/spec/DECISIONS. PROMPTS stays untouched until validation.
- Review focus: same-size filter resets; pure stable sorts and terminal/date boundaries; chip focus and hidden control focus; interactive/selected-text row clicks; native dialog toast/menu placement; A failure/B success independence and one announcement per result.
- [x] Add RED selector tests for applied descending/ID tie, due ascending active-first, overdue today/terminal/missing-date boundaries and source immutability; implement `ApplicantSort` and `sortWorkspaceApplicants`.
- [x] Add RED UI tests for compact summary (other tabs preserve full metrics), top range/size, Collapsible + chips/reset preservation, sort before pagination, row cell/whitespace opening and interactive/text-selection exclusion, name keyboard fallback, per-ID success/failure toast persistence and modal host.
- [x] Install only Input/Collapsible/Dropdown Menu/Sonner via CLI4.21.3; use existing semantic tokens. Implement Applicants layout: search min-width240px, title/count + one-line summary,14px body/12px secondary/approximately64px rows, sticky name, outline forward action and menu rejection.
- [x] Move mutation results to Sonner (success4000ms/errorInfinity/close/identity update). Keep feedback form error nearby, loading/query errors/empty states. Verify root toast behind native dialog before selecting a minimal top-layer host solution; retain one Toaster/live region.
- [x] Verify1440/768/390px, native keyboard/filter/chip/menu, row text selection, toast timer/persistent error/modal visibility and safe close focus. Run lint/test/build + scope diff check, independent review, report actual results here and to original chat. Stop at validation gate.


## Expanded candidate verification — 2026-10-07 (user gate pending)

- Current scope is applicants-workspace-ux; branch feat/applicants-pagination retained. No staging/commit/PROMPTS edit or scheduling implementation.
- Full npm run lint passed. Full npm run test passed: 9 files, 145 tests, 30.88s. npm run build passed: JS855.26kB/gzip294.60kB, existing >500kB warning remains.
- Scope git diff --check passed excluding the pre-existing AGENTS.md change. Whole workspace check reports only AGENTS.md:89 trailing blank line. Staged diff is empty.
- Selector tests cover copy/empty/applied tie/DUE missing/terminal/OVERDUE today boundaries. App tests cover sort before paging, filter/chip/reset/tab preservation, selected text/row space, A failure after B expiry, manual A close preserving B, same-ID Infinity→4000 replacement auto-expiry, and one stable live region through detail/confirmation/body.
- Review found menu Escape also closed detail. RED reproduced; App respects defaultPrevented, regression GREEN. Independent read-only review reports no unresolved material finding. Common Table sticky prop wiring and unsupported registry animation classes were corrected; unused next-themes and old mutation banner CSS removed.
- Actual IAB/MSW browser: general cell whitespace opens detail; native text drag selects owner without opening; name Space opens; menu Enter reaches rejection confirmation, focuses Cancel, Escape returns menu trigger and keeps detail; menu Escape only closes menu; detail Escape returns name. Advanced owner filter remains effective collapsed (60 results), last chip removal returns search focus. DUE ordering and page reset observed.
- Root Toaster under native dialog was reproduced by hit test (DIALOG instead of toast). Stable portal host now shows toast within detail and topmost confirmation; one Toaster/one polite region, localized close button actually dismisses. Saved toast-modal/ toast-confirmation screenshots. Forced failures/timers verified in MSW integration tests; actual screen-reader speech and forced failure in browser were not performed.
- Final1440/768/390px screenshots and bounding boxes: each previous/next80×44px, gap8px, verticalpadding16px, pagefont14px, center delta<0.01px. Search885.54/241.54/351px respectively; mobile matches full available width. Body horizontal overflow absent. Rows66.5–67px. Mobile sticky name width192px and scrollLeft547 while its left stays at container left13px.
- Evidence files: applicants-workspace-ux-top-{1440,768,390}.jpg, footer-{1440,768,390}.jpg, footer-measurements.json, sticky-390.jpg, toast-modal.jpg, toast-confirmation.jpg in the current visualization directory. Temporary viewport override reset; preview tab retained.
- Remaining user scenarios: review compact toolbar/table/footer at desktop/mobile, filter/sort/reset/size and tab context, row/detail keyboard and menu confirmation, toast visibility/timing. User acceptance remains required before prompt-record/staging. Next priority after the existing gate is stage-scheduling.


## User-reported hover correction — 2026-10-07

- Actual normal-row hover differed: row alpha≈0.5 versus opaque sticky rgb(241,244,248); selected name hover added a separate muted patch. Rewrote only TableRow/TableHead/TableCell state backgrounds and the applicant Button variant. Row owns an opaque color, sticky inherits, name remains transparent, selected excludes hover/expanded rules, header never highlights, and row transition is0s.
- Real ApplicantsView fixture (no API/storage writes) and CDP mouse movement verified actual1440/768/390px rendered CSS: default rgb(255,255,255), hovered/expanded normal rgb(241,244,248), selected including hover/expanded rgb(232,240,255); sticky matches row and name stays transparent. Horizontal scroll verified at768 and390. Action keyboard focus remains visible. Parent independently verified regular App normal/name/menu-away/background-reset/header.
- 37 runtime render records saved in hover-after-render-measurements.json. Raw CDP PNG coordinates/scale differ from CSS; bulk pixel assertions failed and are not completion evidence. Correct explicit-CSS-clip representative: hover-fixed-390.png. Further raster exploration stopped on parent/user request. Temporary fixture removed; artifacts retain its source separately.
- Final npm run lint passed, npm run test9files145tests passed(32.39s), npm run build passed(JS855.25kB/gzip294.60kB;500kB warning remains), scope diff check passed. User validation gate remains pending; PROMPTS/staging/commit untouched.

## PR publication request — 2026-10-07

- After the corrected candidate and limitations were reported, the user requested a PR. Record the current scope, run the focused prompt contract and scope whitespace checks, stage only its files, and commit/push to a PR targeting dev. This request is publication authorization, not a claim of additional user-run manual tests. Application code is unchanged since the final 145-test/lint/build pass.
