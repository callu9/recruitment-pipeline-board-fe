import type { QueryClient } from '@tanstack/react-query'
const pending = new WeakMap<QueryClient, Set<string>>()
export function getApplicantPending(client: QueryClient) {
  if (!pending.has(client)) pending.set(client, new Set())
  return pending.get(client)!
}
