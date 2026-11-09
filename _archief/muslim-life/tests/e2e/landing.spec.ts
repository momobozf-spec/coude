import { expect, test } from '@playwright/test'

/**
 * Smoke tests for the public site.
 *
 * These need no database, so they are the ones that can run anywhere. The
 * authenticated journeys (register → onboard → dashboard, habit tick → streak,
 * premium gate) land alongside their phases, since each needs seeded data.
 */

test.describe('landing page', () => {
  test('renders the hero and the primary calls to action', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Your Muslim life, organized.' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Start free' }).first()).toBeVisible()
  })

  test('exposes every landing section', async ({ page }) => {
    await page.goto('/')

    for (const heading of [
      'Everything your day needs',
      'Plan the week you meant to have',
      'From intention to a real plan',
      'Find halal life around you',
      'Muslim Life Premium',
      'Questions, answered',
    ]) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    }
  })

  test('labels demonstration listings honestly', async ({ page }) => {
    await page.goto('/')

    // Non-negotiable: demo data must never look like a verified real business.
    await expect(page.getByText('Demo listing').first()).toBeVisible()
    await expect(
      page.getByText('Listings shown are demonstration data during early access.'),
    ).toBeVisible()
  })

  test('states that the assistant is not a scholar', async ({ page }) => {
    await page.goto('/')

    await expect(
      page.getByText(/It is not a scholar and does not issue religious rulings/),
    ).toBeVisible()
  })

  test('navigates to pricing and shows both plans', async ({ page }) => {
    await page.goto('/pricing')

    await expect(page.getByRole('heading', { name: 'Simple, honest pricing' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Muslim Life Free' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Muslim Life Premium' })).toBeVisible()
  })

  test('redirects an anonymous visitor away from the app', async ({ page }) => {
    await page.goto('/app')

    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  })

  test('protects the admin area', async ({ page }) => {
    await page.goto('/admin')

    await expect(page).toHaveURL(/\/login/)
  })
})
