import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { hasDatabase, createRuleSet, createTestUser, prisma, resetDatabase } from './setup'
import { createAsset } from '@/server/modules/assets/service'
import {
  discardDraft,
  finalizeCalculation,
  getOrCreateDraft,
  readCalculation,
  recalculateDraft,
  saveWizardStep,
} from '@/server/modules/zakat/calculation-service'
import { CalculationIncompleteError } from '@/server/modules/zakat/errors'
import { EntitlementError } from '@/lib/errors'

/**
 * Wizard behaviour (§30): autosave, resume, incomplete, finalize.
 *
 * The point of these is that wizard state survives the browser — nothing here
 * relies on client memory, because financial input that only exists in a tab is
 * input the user will lose.
 */

const suite = hasDatabase ? describe : describe.skip

suite('wizard', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  async function userWithAssets(email: string) {
    await createRuleSet()
    const actor = await createTestUser({ email })
    await createAsset(actor, {
      type: 'SAVINGS',
      name: 'Spaargeld',
      value: '35000.00',
      currency: 'EUR',
    })
    return actor
  }

  it('reuses one draft rather than starting a new calculation each visit', async () => {
    const actor = await userWithAssets('w1@test.local')

    const first = await getOrCreateDraft(actor)
    const second = await getOrCreateDraft(actor)

    expect(second.id).toBe(first.id)
    expect(await prisma.zakatCalculation.count({ where: { userId: actor.userId } })).toBe(1)
  })

  it('remembers the step across sessions', async () => {
    const actor = await userWithAssets('w2@test.local')
    const draft = await getOrCreateDraft(actor)

    await saveWizardStep(actor, draft.id, 4)

    // A "new session": read it back from the database, nothing cached.
    const resumed = await readCalculation(actor, draft.id)
    expect(resumed.wizardStep).toBe(4)
    expect(resumed.status).toBe('DRAFT')
  })

  it('clamps an out-of-range step instead of storing nonsense', async () => {
    const actor = await userWithAssets('w3@test.local')
    const draft = await getOrCreateDraft(actor)

    await saveWizardStep(actor, draft.id, 99)
    expect((await readCalculation(actor, draft.id)).wizardStep).toBe(8)

    await saveWizardStep(actor, draft.id, -3)
    expect((await readCalculation(actor, draft.id)).wizardStep).toBe(1)
  })

  it('reflects newly added assets when the draft is recalculated', async () => {
    const actor = await userWithAssets('w4@test.local')
    const draft = await getOrCreateDraft(actor)
    expect(draft.grossAssetsMinor).toBe(3_500_000)

    await createAsset(actor, {
      type: 'INVESTMENTS',
      name: 'Beleggingen',
      value: '15000.00',
      currency: 'EUR',
    })

    const updated = await recalculateDraft(actor, draft.id)

    // A draft is a live preview — that is the whole difference from a snapshot.
    expect(updated.id).toBe(draft.id)
    expect(updated.grossAssetsMinor).toBe(5_000_000)
    expect(updated.zakatDueMinor).toBe(125_000)
  })

  it('replaces items on recalculation rather than accumulating them', async () => {
    const actor = await userWithAssets('w5@test.local')
    const draft = await getOrCreateDraft(actor)

    await recalculateDraft(actor, draft.id)
    await recalculateDraft(actor, draft.id)

    const items = await prisma.zakatCalculationItem.count({
      where: { calculationId: draft.id },
    })
    expect(items).toBe(1)
  })

  it('refuses to finalise an empty calculation', async () => {
    await createRuleSet()
    const actor = await createTestUser({ email: 'w6@test.local' })
    const draft = await getOrCreateDraft(actor)

    await expect(finalizeCalculation(actor, draft.id)).rejects.toThrow(CalculationIncompleteError)
  })

  it('completes the full flow: draft → review → finalise → reopen', async () => {
    const actor = await userWithAssets('w7@test.local')

    const draft = await getOrCreateDraft(actor)
    await saveWizardStep(actor, draft.id, 8)

    const reviewed = await recalculateDraft(actor, draft.id)
    const finalized = await finalizeCalculation(actor, draft.id)

    expect(finalized.status).toBe('FINALIZED')
    expect(finalized.zakatDueMinor).toBe(reviewed.zakatDueMinor)

    // Reopening months later shows the same figures and the same sources.
    const reopened = await readCalculation(actor, finalized.id)
    expect(reopened.zakatDueMinor).toBe(finalized.zakatDueMinor)
    expect(reopened.nisabValueMinor).toBe(finalized.nisabValueMinor)
    expect(reopened.rulesVersion).toBe(finalized.rulesVersion)
    expect(reopened.rates).toEqual(finalized.rates)
  })

  it('lets a discarded draft be replaced', async () => {
    const actor = await userWithAssets('w8@test.local')

    const draft = await getOrCreateDraft(actor)
    await discardDraft(actor, draft.id)

    const replacement = await getOrCreateDraft(actor)
    expect(replacement.id).not.toBe(draft.id)
  })

  it('counts finalised years against the plan, not abandoned drafts', async () => {
    await createRuleSet()
    const actor = await createTestUser({ email: 'w9@test.local', plan: 'FREE' })
    await createAsset(actor, {
      type: 'SAVINGS',
      name: 'Spaargeld',
      value: '35000.00',
      currency: 'EUR',
    })

    const first = await getOrCreateDraft(actor)
    await finalizeCalculation(actor, first.id)

    // FREE allows one finalised calculation per year; the second must be refused.
    await expect(getOrCreateDraft(actor)).rejects.toThrow(EntitlementError)
  })
})
