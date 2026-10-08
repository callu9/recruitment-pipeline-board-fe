import { useCallback, useEffect, useRef, useState } from 'react'
import { APPLICANT_OWNERS, APPLICANT_ROLES } from './applicant.types'
import { STAGES } from './stages'
import { EMPTY_FILTERS, type ApplicantPageSize, type ApplicantSort, type WorkspaceFilters } from './workspaceSelectors'

export type View = 'insights' | 'archive' | 'applicants' | 'today' | 'calendar' | 'positions'
interface NavigationState { view: View; filters: WorkspaceFilters; sort: ApplicantSort; page: number; pageSize: ApplicantPageSize; selectedId: string | null }
const views: View[] = ['insights', 'archive', 'applicants', 'today', 'calendar', 'positions']
const ownedKeys = ['view', 'name', 'role', 'owner', 'stage', 'position', 'noSchedule', 'overdue', 'sort', 'page', 'size', 'applicant']

export function readWorkspaceUrl(search: string): NavigationState {
  const p = new URLSearchParams(search)
  const page = Number(p.get('page'))
  const size = Number(p.get('size'))
  return {
    view: views.includes(p.get('view') as View) ? p.get('view') as View : 'applicants',
    filters: { ...EMPTY_FILTERS, name: p.get('name') ?? '', role: APPLICANT_ROLES.includes(p.get('role') as never) ? p.get('role') as WorkspaceFilters['role'] : 'ALL', owner: APPLICANT_OWNERS.includes(p.get('owner') as never) ? p.get('owner')! : 'ALL', stage: STAGES.some(({ code }) => code === p.get('stage')) ? p.get('stage') as WorkspaceFilters['stage'] : 'ALL', positionId: p.get('position') ?? '', noSchedule: p.get('noSchedule') === '1', overdue: p.get('overdue') === '1' },
    sort: ['APPLIED', 'DUE', 'OVERDUE'].includes(p.get('sort') ?? '') ? p.get('sort') as ApplicantSort : 'APPLIED',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: [20, 50, 100].includes(size) ? size as ApplicantPageSize : 20,
    selectedId: p.get('applicant') || null,
  }
}

function stateUrl(state: NavigationState) {
  const url = new URL(window.location.href)
  ownedKeys.forEach((key) => url.searchParams.delete(key))
  const put = (key: string, value: string, fallback = '') => { if (value !== fallback) url.searchParams.set(key, value) }
  put('view', state.view, 'applicants'); put('name', state.filters.name)
  put('role', state.filters.role, 'ALL'); put('owner', state.filters.owner, 'ALL'); put('stage', state.filters.stage, 'ALL'); put('position', state.filters.positionId)
  if (state.filters.noSchedule) put('noSchedule', '1')
  if (state.filters.overdue) put('overdue', '1')
  put('sort', state.sort, 'APPLIED'); put('page', String(state.page), '1'); put('size', String(state.pageSize), '20'); put('applicant', state.selectedId ?? '')
  return url
}

export function useWorkspaceNavigation(onRestore: () => void) {
  const [state, setState] = useState(() => readWorkspaceUrl(window.location.search))
  const current = useRef(state)
  const navigate = useCallback((patch: Partial<NavigationState>, mode: 'push' | 'replace' = 'push') => {
    const next = { ...current.current, ...patch }
    current.current = next
    const url = stateUrl(next)
    if (url.href !== window.location.href) window.history[mode === 'push' ? 'pushState' : 'replaceState'](window.history.state, '', url)
    setState(next)
  }, [])
  useEffect(() => {
    const restore = () => {
      const next = readWorkspaceUrl(window.location.search)
      if (document.querySelector('dialog [data-draft-error="true"]') && !window.confirm('초안을 보관하지 못했습니다. 작성 내용을 버리고 이동할까요?')) {
        window.history.pushState(window.history.state, '', stateUrl(current.current))
        return
      }
      onRestore()
      current.current = next
      setState(next)
    }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [onRestore])
  const setView = useCallback((view: View) => navigate({ view, selectedId: null }), [navigate])
  const setFilters = useCallback((filters: WorkspaceFilters) => navigate({ filters, page: 1 }, 'replace'), [navigate])
  const setSort = useCallback((sort: ApplicantSort) => navigate({ sort, page: 1 }, 'replace'), [navigate])
  const setPage = useCallback((page: number) => navigate({ page }, 'replace'), [navigate])
  const setPageSize = useCallback((pageSize: ApplicantPageSize) => navigate({ pageSize, page: 1 }, 'replace'), [navigate])
  const setSelectedId = useCallback((selectedId: string | null) => navigate({ selectedId }), [navigate])
  return { ...state, navigate, setView, setFilters, setSort, setPage, setPageSize, setSelectedId }
}
