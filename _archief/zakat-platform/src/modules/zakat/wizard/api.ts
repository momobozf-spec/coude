'use client'

import type { AssetView } from '@/server/modules/assets/service'
import type { LiabilityView } from '@/server/modules/liabilities/service'
import type { StoredCalculationView } from '@/server/modules/zakat/calculation-service'

/**
 * Thin client for the wizard.
 *
 * Errors from the API arrive in the shape `respond.ts` produces, so the wizard
 * can surface the domain message ("je Gratis-abonnement staat 10 posten toe")
 * rather than a generic failure.
 */

export class ApiError extends Error {
  readonly code: string
  readonly requiredPlan: string | null

  constructor(message: string, code: string, requiredPlan: string | null = null) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.requiredPlan = requiredPlan
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  if (response.status === 204) return undefined as T

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(
      body?.error?.message ?? 'Er ging iets mis.',
      body?.error?.code ?? 'UNKNOWN',
      body?.error?.requiredPlan ?? null,
    )
  }

  return body as T
}

export const api = {
  listAssets: () =>
    request<{ assets: AssetView[]; usage: { used: number; limit: number | null } }>('/api/assets'),

  createAsset: (payload: unknown) =>
    request<AssetView>('/api/assets', { method: 'POST', body: JSON.stringify(payload) }),

  updateAsset: (id: string, payload: unknown) =>
    request<AssetView>(`/api/assets/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  deleteAsset: (id: string) => request<void>(`/api/assets/${id}`, { method: 'DELETE' }),

  listLiabilities: () =>
    request<{ liabilities: LiabilityView[]; usage: { used: number; limit: number | null } }>(
      '/api/liabilities',
    ),

  createLiability: (payload: unknown) =>
    request<LiabilityView>('/api/liabilities', { method: 'POST', body: JSON.stringify(payload) }),

  updateLiability: (id: string, payload: unknown) =>
    request<LiabilityView>(`/api/liabilities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteLiability: (id: string) => request<void>(`/api/liabilities/${id}`, { method: 'DELETE' }),

  recalculate: (id: string, payload: unknown = {}) =>
    request<StoredCalculationView>(`/api/zakat/calculations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  saveStep: (id: string, step: number) =>
    request<void>(`/api/zakat/calculations/${id}/step`, {
      method: 'PUT',
      body: JSON.stringify({ step }),
    }),

  finalize: (id: string) =>
    request<StoredCalculationView>(`/api/zakat/calculations/${id}/finalize`, { method: 'POST' }),

  saveProfile: (payload: unknown) =>
    request<unknown>('/api/zakat/profile', { method: 'PATCH', body: JSON.stringify(payload) }),

  /** One onboarding step at a time, so a half-finished onboarding is resumable. */
  saveProfileStep: (payload: unknown) =>
    request<unknown>('/api/zakat/onboarding', { method: 'POST', body: JSON.stringify(payload) }),
}
