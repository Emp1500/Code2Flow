import type { Flowchart, FlowchartVersion, Language } from '@/types'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const jsonHeaders = { 'Content-Type': 'application/json' }

async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const message = body && typeof body.error === 'string' ? body.error : `Request failed with status ${res.status}`
    throw new ApiError(message, res.status)
  }
  return res.json() as Promise<T>
}

export function fetchFlowchart(id: string) {
  return apiFetch<Flowchart & { code: string; version_number: number }>(`/api/flowcharts/${id}`)
}

export function createFlowchart(input: { title: string; code: string; language: Language }) {
  return apiFetch<Flowchart>('/api/flowcharts', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(input),
  })
}

export function updateFlowchart(id: string, input: { code?: string; title?: string; language?: Language }) {
  return apiFetch<Flowchart>(`/api/flowcharts/${id}`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify(input),
  })
}

export function renameFlowchart(id: string, title: string) {
  return apiFetch<Flowchart>(`/api/flowcharts/${id}`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ title }),
  })
}

export function deleteFlowchart(id: string) {
  return apiFetch<{ success: true }>(`/api/flowcharts/${id}`, { method: 'DELETE' })
}

export function toggleShare(id: string) {
  return apiFetch<{ is_public: boolean; share_id: string | null }>(`/api/flowcharts/${id}/share`, { method: 'POST' })
}

export function fetchVersions(flowchartId: string) {
  return apiFetch<Pick<FlowchartVersion, 'id' | 'version_number' | 'created_at'>[]>(
    `/api/flowcharts/${flowchartId}/versions`
  )
}

export function fetchVersion(flowchartId: string, versionNumber: number) {
  return apiFetch<Pick<FlowchartVersion, 'id' | 'code' | 'version_number' | 'created_at'>>(
    `/api/flowcharts/${flowchartId}/versions?v=${versionNumber}`
  )
}
