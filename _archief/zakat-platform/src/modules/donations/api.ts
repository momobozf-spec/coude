'use client'

import type { DonationView } from '@/server/modules/donations/view'
import type { ZakatPaymentSummary } from '@/server/modules/donations/payment-service'
import type {
  SadaqahGoalProgress,
  SadaqahGoalView,
} from '@/server/modules/donations/sadaqah-service'
import type { ReceiptView } from '@/server/modules/donations/receipt-service'

/**
 * Client for the donation endpoints.
 *
 * Errors keep the shape `respond.ts` produces, so a form can show the domain
 * message ("je kunt alleen betalingen koppelen aan een afgeronde berekening")
 * instead of a generic failure.
 */

export class DonationApiError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'DonationApiError'
    this.code = code
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData

  const response = await fetch(url, {
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  })

  if (response.status === 204) return undefined as T

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new DonationApiError(
      body?.error?.message ?? 'Er ging iets mis.',
      body?.error?.code ?? 'UNKNOWN',
    )
  }

  return body as T
}

/**
 * A per-form key so a double submit or a mobile retry cannot register the same
 * payment twice (§37). Generated once when the form mounts, reused on retry.
 */
export function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const donationApi = {
  list: (params: Record<string, string> = {}) =>
    request<{ donations: DonationView[]; years: number[] }>(
      `/api/donations?${new URLSearchParams(params).toString()}`,
    ),

  create: (payload: unknown) =>
    request<DonationView>('/api/donations', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id: string, payload: unknown) =>
    request<DonationView>(`/api/donations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  /** Voids the donation; it stays visible in history but stops counting. */
  void: (id: string, reason?: string) =>
    request<DonationView>(`/api/donations/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    }),

  paymentSummary: (calculationId: string) =>
    request<ZakatPaymentSummary>(`/api/zakat/calculations/${calculationId}/payments`),

  registerPayment: (calculationId: string, payload: unknown) =>
    request<{ donation: DonationView; summary: ZakatPaymentSummary }>(
      `/api/zakat/calculations/${calculationId}/payments`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  uploadReceipt: (donationId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<ReceiptView>(`/api/donations/${donationId}/receipt`, {
      method: 'POST',
      body: form,
    })
  },

  deleteReceipt: (donationId: string) =>
    request<void>(`/api/donations/${donationId}/receipt`, { method: 'DELETE' }),

  listGoals: () => request<{ goals: SadaqahGoalProgress[] }>('/api/sadaqah/goals'),

  createGoal: (payload: unknown) =>
    request<SadaqahGoalView>('/api/sadaqah/goals', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  archiveGoal: (id: string) =>
    request<SadaqahGoalView>(`/api/sadaqah/goals/${id}`, { method: 'DELETE' }),
}
