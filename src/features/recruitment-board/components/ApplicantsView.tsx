import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { EllipsisIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { APPLICANT_OWNERS, APPLICANT_ROLES, type Applicant, type ApplicantStage, type Position } from '../model/applicant.types'
import { getAllowedNextStages, getForwardActionLabel, isTerminalStage, STAGES } from '../model/stages'
import { EMPTY_FILTERS, filterWorkspaceApplicants, getStageCounts, hasPendingEvaluation, isOverdue, type ApplicantPageSize, type ApplicantSort, type paginateApplicants, type WorkspaceFilters } from '../model/workspaceSelectors'

function dateLabel(value?: string) { return value ? value.slice(0, 10).replaceAll('-', '.') : '미정' }
function applicantName(applicant: Applicant) { return `${applicant.name} · ${applicant.id}` }

export function StageActionButtons({ applicant, isPending, onMove, onReject }: { applicant: Applicant; isPending: boolean; onMove: (stage: ApplicantStage, trigger?: HTMLButtonElement) => void; onReject: (trigger?: HTMLButtonElement) => void }) {
  const nextStage = getAllowedNextStages(applicant.stage).find((stage) => stage !== 'REJECTED')
  const trigger = useRef<HTMLButtonElement>(null)
  const [container, setContainer] = useState<HTMLDialogElement | undefined>()
  if (isTerminalStage(applicant.stage)) return <span className="text-sm text-muted-foreground">종료됨</span>
  const label = applicantName(applicant)
  return <div className="flex items-center gap-2" aria-label={`${label} 단계 액션`} aria-busy={isPending}>
    {nextStage && <Button type="button" variant="outline" aria-label={`${getForwardActionLabel(applicant.stage)} · ${label}`} disabled={isPending} onClick={(event) => onMove(nextStage, event.currentTarget)}>{isPending ? '저장 중' : getForwardActionLabel(applicant.stage)}</Button>}
    <DropdownMenu onOpenChange={() => setContainer(trigger.current?.closest('dialog') ?? undefined)}>
      <DropdownMenuTrigger asChild><Button ref={trigger} type="button" variant="ghost" aria-label={`더 보기 · ${label}`} disabled={isPending}><EllipsisIcon /></Button></DropdownMenuTrigger>
      <DropdownMenuContent container={container} align="end"><DropdownMenuItem variant="destructive" aria-label={`불합격 처리 · ${label}`} onSelect={() => queueMicrotask(() => onReject(trigger.current ?? undefined))}>불합격 처리</DropdownMenuItem></DropdownMenuContent>
    </DropdownMenu>
  </div>
}

export function ApplicantsView({ applicants, pagination, pageSize, sort, onSortChange, onPageChange, onPageSizeChange, headingRef, hasOpenDialog, filters, setFilters, onSelect, selectedId, pendingIds, onMove, onReject, positions, positionsError, refetchPositions, today }: {
  applicants: Applicant[]
  pagination: ReturnType<typeof paginateApplicants>
  pageSize: ApplicantPageSize
  sort: ApplicantSort
  onSortChange: (sort: ApplicantSort) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: ApplicantPageSize) => void
  headingRef: RefObject<HTMLHeadingElement | null>
  hasOpenDialog: boolean
  filters: WorkspaceFilters
  setFilters: (next: WorkspaceFilters) => void
  onSelect: (id: string, trigger?: HTMLButtonElement) => void
  selectedId: string | null
  pendingIds: ReadonlySet<string>
  onMove: (applicant: Applicant, stage: ApplicantStage, trigger?: HTMLButtonElement) => void
  onReject: (applicant: Applicant, trigger?: HTMLButtonElement) => void
  positions: Position[]
  positionsError: boolean
  refetchPositions: () => Promise<unknown>
  today: string
}) {
  const baseFiltered = filterWorkspaceApplicants(applicants, { ...filters, stage: 'ALL' }, today)
  const counts = getStageCounts(baseFiltered)
  const focusedRowControl = useRef<HTMLElement | null>(null)
  const search = useRef<HTMLInputElement>(null)
  const chips = useRef<HTMLDivElement>(null)
  const filterToggle = useRef<HTMLButtonElement>(null)
  const [expanded, setExpanded] = useState(false)
  const extraCount = Number(filters.owner !== 'ALL') + Number(Boolean(filters.positionId)) + Number(filters.noSchedule) + Number(filters.overdue)
  const active = [
    { key: 'name', label: `이름 ${filters.name}`, value: filters.name, reset: '' },
    { key: 'role', label: `직무 ${filters.role}`, value: filters.role !== 'ALL', reset: 'ALL' },
    { key: 'owner', label: `담당자 ${filters.owner}`, value: filters.owner !== 'ALL', reset: 'ALL' },
    { key: 'positionId', label: `포지션 ${positions.find(({ id }) => id === filters.positionId)?.title ?? '선택됨'}`, value: filters.positionId, reset: '' },
    { key: 'noSchedule', label: '일정 없음', value: filters.noSchedule, reset: false },
    { key: 'overdue', label: '기한 초과', value: filters.overdue, reset: false },
    { key: 'stage', label: `단계 ${STAGES.find(({ code }) => code === filters.stage)?.label}`, value: filters.stage !== 'ALL', reset: 'ALL' },
  ] as const
  const activeFilters = active.filter(({ value }) => value)
  const update = (key: keyof WorkspaceFilters, value: string | boolean) => setFilters({ ...filters, [key]: value })

  useLayoutEffect(() => {
    if (focusedRowControl.current && !focusedRowControl.current.isConnected && document.activeElement === document.body && !hasOpenDialog) headingRef.current?.focus({ preventScroll: true })
  })

  function navigate(page: number) {
    onPageChange(page)
    if (!hasOpenDialog) {
      headingRef.current?.focus({ preventScroll: true })
      headingRef.current?.scrollIntoView?.({ block: 'start' })
    }
  }
  function removeFilter(key: keyof WorkspaceFilters, reset: string | boolean) {
    update(key, reset)
    queueMicrotask(() => (chips.current?.querySelector<HTMLButtonElement>('button') ?? search.current)?.focus())
  }

  return <section className="min-w-0" aria-labelledby="applicants-heading">
    <div className="my-6 flex flex-wrap items-center justify-between gap-2">
      <h2 id="applicants-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight">지원자 <span className="text-muted-foreground">{applicants.length}</span></h2>
      <p className="text-sm text-muted-foreground">진행 중 {applicants.filter(({ stage }) => !isTerminalStage(stage)).length} · 평가 대기 {applicants.filter((item) => !isTerminalStage(item.stage) && hasPendingEvaluation(item)).length}</p>
    </div>
    {positionsError && <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive bg-background p-3 text-sm text-destructive" role="alert"><span>포지션 정보를 불러오지 못했습니다. 포지션 필터를 사용할 수 없습니다.</span><Button type="button" variant="outline" onClick={() => void refetchPositions()}>포지션 정보 다시 시도</Button></div>}
    <Collapsible open={expanded} onOpenChange={(open) => { if (!open && document.activeElement?.closest('[data-slot="collapsible-content"]')) filterToggle.current?.focus(); setExpanded(open) }}>
      <div className="flex flex-wrap items-end gap-3" aria-label="지원자 필터">
        <label className="grid w-full gap-1 text-sm font-medium sm:min-w-60 sm:flex-1 sm:basis-60">이름 검색<Input ref={search} value={filters.name} placeholder="지원자 이름 검색" onChange={(event) => update('name', event.target.value)} /></label>
        <label className="grid w-full gap-1 text-sm font-medium sm:w-auto">직무<NativeSelect className="w-full" value={filters.role} onChange={(event) => update('role', event.target.value)}><NativeSelectOption value="ALL">전체 직무</NativeSelectOption>{APPLICANT_ROLES.map((role) => <NativeSelectOption key={role}>{role}</NativeSelectOption>)}</NativeSelect></label>
        <label className="grid w-full gap-1 text-sm font-medium sm:w-auto">정렬<NativeSelect className="w-full" value={sort} onChange={(event) => { const value = event.target.value; if (value === 'APPLIED' || value === 'DUE' || value === 'OVERDUE') onSortChange(value) }}><NativeSelectOption value="APPLIED">지원일 최신순</NativeSelectOption><NativeSelectOption value="DUE">마감 임박순</NativeSelectOption><NativeSelectOption value="OVERDUE">지연 우선</NativeSelectOption></NativeSelect></label>
        <CollapsibleTrigger asChild><Button ref={filterToggle} type="button" variant="outline">추가 필터{extraCount > 0 ? ` · ${extraCount}` : ''}</Button></CollapsibleTrigger>
        <Button type="button" variant="ghost" disabled={!activeFilters.length} onClick={() => setFilters(EMPTY_FILTERS)}>초기화</Button>
      </div>
      <CollapsibleContent><div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border bg-background p-4">
        <label className="grid w-full gap-1 text-sm font-medium sm:w-auto">담당자<NativeSelect className="w-full" value={filters.owner} onChange={(event) => update('owner', event.target.value)}><NativeSelectOption value="ALL">전체 담당자</NativeSelectOption>{APPLICANT_OWNERS.map((owner) => <NativeSelectOption key={owner}>{owner}</NativeSelectOption>)}</NativeSelect></label>
        <label className="grid w-full gap-1 text-sm font-medium sm:w-auto">포지션<NativeSelect className="w-full" disabled={positionsError} value={filters.positionId} onChange={(event) => update('positionId', event.target.value)}><NativeSelectOption value="">전체 포지션</NativeSelectOption>{positions.map((position) => <NativeSelectOption key={position.id} value={position.id}>{position.title}</NativeSelectOption>)}</NativeSelect></label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={filters.noSchedule} onChange={(event) => update('noSchedule', event.target.checked)} />일정 없음</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={filters.overdue} onChange={(event) => update('overdue', event.target.checked)} />기한 초과</label>
      </div></CollapsibleContent>
    </Collapsible>
    {activeFilters.length > 0 && <div ref={chips} className="mt-3 flex flex-wrap gap-2" aria-label="적용된 필터">{activeFilters.map(({ key, label, reset }) => <Button key={key} type="button" variant="secondary" aria-label={`${label} 필터 해제`} onClick={() => removeFilter(key, reset)}>{label}<XIcon /></Button>)}</div>}
    <nav className="mt-4 mb-4 flex gap-1 overflow-x-auto" aria-label="단계별 지원자 필터">
      <Button type="button" variant={filters.stage === 'ALL' ? 'secondary' : 'ghost'} aria-pressed={filters.stage === 'ALL'} onClick={() => update('stage', 'ALL')}>전체 <span>{baseFiltered.length}</span></Button>
      {STAGES.map((stage) => <Button type="button" key={stage.code} variant={filters.stage === stage.code ? 'secondary' : 'ghost'} aria-pressed={filters.stage === stage.code} onClick={() => update('stage', stage.code)}>{stage.label} <span>{counts[stage.code]}</span></Button>)}
    </nav>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground" role="status" aria-label="지원자 페이지 상태">총 {pagination.total}명{pagination.total > 0 && <> · {pagination.from}–{pagination.to}명<span className="sr-only"> · {pagination.page} / {pagination.totalPages} 페이지</span></>}</p>
      {pagination.total > 0 && <label className="flex items-center gap-2 text-sm"><span className="sr-only">페이지당 표시</span><NativeSelect value={pageSize} onChange={(event) => { const size = Number(event.target.value); if (size === 20 || size === 50 || size === 100) onPageSizeChange(size) }}>{([20, 50, 100] as const).map((size) => <NativeSelectOption key={size} value={size}>{size}명씩 보기</NativeSelectOption>)}</NativeSelect></label>}
    </div>
    {pagination.total === 0 ? <div className="grid min-h-64 content-center justify-items-center gap-3 rounded-lg border bg-background p-6 text-center"><h3>조건에 맞는 지원자가 없습니다.</h3><p className="text-sm text-muted-foreground">검색어나 필터를 초기화해 다시 확인하세요.</p><Button type="button" variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>필터 초기화</Button></div> : <>
      <div className="rounded-lg border bg-background" onFocusCapture={(event) => { focusedRowControl.current = event.target as HTMLElement }}>
        <Table className="min-w-4xl"><caption className="sr-only">지원자 목록</caption>
          <TableHeader><TableRow><TableHead scope="col" sticky>지원자</TableHead><TableHead scope="col">단계</TableHead><TableHead scope="col">담당자</TableHead><TableHead scope="col">다음 액션</TableHead><TableHead scope="col">일정</TableHead><TableHead scope="col"><span className="sr-only">액션</span></TableHead></TableRow></TableHeader>
          <TableBody>{pagination.items.map((applicant) => <TableRow key={applicant.id} data-state={selectedId === applicant.id ? 'selected' : undefined} onClick={(event) => {
            if (!(event.target instanceof Element) || event.target.closest('button,a,input,select,textarea,[role="menuitem"],[role="button"]') || window.getSelection()?.toString().trim()) return
            onSelect(applicant.id, event.currentTarget.querySelector<HTMLButtonElement>('[data-applicant-trigger]') ?? undefined)
          }}>
            <TableCell sticky><Button data-applicant-trigger type="button" variant="applicant" size="applicant" aria-label={`지원자 상세 보기: ${applicantName(applicant)}`} aria-pressed={selectedId === applicant.id} onClick={(event) => onSelect(applicant.id, event.currentTarget)}><span className="grid min-w-0 gap-1"><strong>{applicant.name}</strong><span className="truncate text-xs text-muted-foreground">{applicant.role} · 지원 {dateLabel(applicant.appliedAt)}</span></span></Button></TableCell>
            <TableCell><Badge variant={applicant.stage === 'REJECTED' ? 'destructive' : applicant.stage === 'HIRED' ? 'outline' : 'secondary'}>{STAGES.find(({ code }) => code === applicant.stage)?.label}</Badge></TableCell>
            <TableCell>{applicant.owner ?? '미지정'}</TableCell>
            <TableCell><span className={isOverdue(applicant, today) ? 'font-semibold text-destructive' : ''}>{applicant.nextAction ?? '없음'}</span><small className="block text-xs text-muted-foreground">{dateLabel(applicant.dueDate)}</small></TableCell>
            <TableCell>{applicant.schedule ? <><strong>{dateLabel(applicant.schedule.date)}</strong><small className="block text-xs text-muted-foreground">{applicant.schedule.startTime} · {applicant.schedule.format === 'VIDEO' ? '화상' : '대면'}</small></> : <span className="text-muted-foreground">미정</span>}</TableCell>
            <TableCell><StageActionButtons applicant={applicant} isPending={pendingIds.has(applicant.id)} onMove={(stage, trigger) => onMove(applicant, stage, trigger)} onReject={(trigger) => onReject(applicant, trigger)} /></TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </div>
      <footer className="w-full py-4"><Pagination aria-label="지원자 페이지 탐색"><PaginationContent>
        <PaginationItem><Button type="button" variant="outline" size="pagination" aria-label="이전 페이지" disabled={pagination.page === 1} onClick={() => navigate(pagination.page - 1)}>이전</Button></PaginationItem>
        <PaginationItem><span className="px-3 text-sm" aria-hidden="true">{pagination.page} / {pagination.totalPages} 페이지</span></PaginationItem>
        <PaginationItem><Button type="button" variant="outline" size="pagination" aria-label="다음 페이지" disabled={pagination.page === pagination.totalPages} onClick={() => navigate(pagination.page + 1)}>다음</Button></PaginationItem>
      </PaginationContent></Pagination></footer>
    </>}
  </section>
}
