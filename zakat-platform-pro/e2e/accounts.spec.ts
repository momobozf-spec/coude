import { createHash, randomBytes } from 'node:crypto'

import { expect, test, type Browser, type Page } from '@playwright/test'
import { Client } from 'pg'

/**
 * Accounts van begin tot eind, in een echte browser tegen een echte database:
 * registreren, vergrendeling, sessies intrekken, wachtwoord wijzigen en
 * herstellen, AVG-export en verwijderen, en de beheerderspagina.
 *
 * Wat hier bewezen wordt gaat over cookies, redirects en twee gelijktijdige
 * sessies — dingen die een unittest niet kan aantonen.
 */

const run = Date.now().toString(36)
const password = (label: string) => `e2e ${label} lange zin ${run} vensterbank`
const ADMIN = { email: 'dev@barakah.local', password: 'barakah-dev-2026' }

async function db<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

async function freshPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext()
  return context.newPage()
}

async function login(page: Page, email: string, secret: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('E-mailadres').fill(email)
  await page.getByLabel('Wachtwoord', { exact: true }).fill(secret)
  await page.getByRole('button', { name: 'Inloggen' }).click()
  // Wacht tot de client-side navigatie na het inloggen klaar is, of tot de
  // foutmelding er staat. Anders loopt de volgende `goto` een race met
  // `router.push('/dashboard')` van het formulier.
  await Promise.race([
    page.waitForURL(/\/(dashboard|onboarding)/),
    formAlert(page).waitFor(),
  ])
  if (/\/(dashboard|onboarding)/.test(page.url())) await settled(page)
}

/** De pagina na een client-side navigatie is gerenderd (het hoofdmenu staat er). */
async function settled(page: Page): Promise<void> {
  await page.getByRole('navigation', { name: 'Hoofdnavigatie' }).first().waitFor()
}

/** De foutmelding van het formulier (niet de route-announcer van Next). */
function formAlert(page: Page) {
  return page.locator('form [role="alert"]')
}

async function register(page: Page, email: string, secret: string): Promise<void> {
  await page.goto('/register')
  await page.getByLabel('Naam').fill('E2E Gebruiker')
  await page.getByLabel('E-mailadres').fill(email)
  await page.getByLabel('Wachtwoord').fill(secret)
  await page.getByRole('button', { name: /aanmelden|account aanmaken/i }).click()
  await page.waitForURL(/\/(dashboard|onboarding)/)
  await settled(page)
}

test('registreren en inloggen', async ({ page }) => {
  const email = `e2e-reg-${run}@test.local`
  await register(page, email, password('reg'))
  await expect(page).not.toHaveURL(/\/login/)

  await page.goto('/profile')
  await expect(page.getByText(email)).toBeVisible()
})

test('vijf foute pogingen vergrendelen het account, met één generieke melding', async ({ browser }) => {
  const email = `e2e-lock-${run}@test.local`
  await register(await freshPage(browser), email, password('lock'))

  const page = await freshPage(browser)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await login(page, email, 'helemaal fout wachtwoord')
    await expect(formAlert(page)).toHaveText(/Inloggen lukte niet/)
  }

  // Nu weigert ook het juiste wachtwoord, met dezelfde melding.
  await login(page, email, password('lock'))
  await expect(page).toHaveURL(/\/login/)
  await expect(formAlert(page)).toHaveText(/Inloggen lukte niet/)

  // Een onbekend adres krijgt exact dezelfde melding.
  await login(page, `bestaat-niet-${run}@test.local`, 'iets')
  await expect(formAlert(page)).toHaveText(/Inloggen lukte niet/)
})

test('overal afmelden trekt ook de sessie op een ander toestel in, zonder redirectlus', async ({ browser }) => {
  const email = `e2e-revoke-${run}@test.local`
  const secret = password('revoke')
  const phone = await freshPage(browser)
  await register(phone, email, secret)

  const laptop = await freshPage(browser)
  await login(laptop, email, secret)
  await laptop.goto('/profile')

  await laptop.getByRole('button', { name: 'Overal afmelden' }).click()
  await laptop.waitForURL(/\/login/)
  await expect(laptop.getByText('Je bent op al je toestellen afgemeld.')).toBeVisible()

  // Het andere toestel heeft nog een geldige handtekening, maar een oude versie.
  await phone.goto('/dashboard')
  await expect(phone).toHaveURL(/\/login\?sessie=verlopen/)
  await expect(phone.getByText(/sessie is verlopen of ingetrokken/)).toBeVisible()

  // En de API weigert met 401.
  const response = await phone.request.get('/api/assets')
  expect(response.status()).toBe(401)
})

test('wachtwoord wijzigen meldt overal af en alleen het nieuwe werkt', async ({ browser }) => {
  const email = `e2e-change-${run}@test.local`
  const oldSecret = password('oud')
  const newSecret = password('nieuw')
  const other = await freshPage(browser)
  await register(other, email, oldSecret)

  const page = await freshPage(browser)
  await login(page, email, oldSecret)
  await page.goto('/profile')
  await page.getByLabel('Huidig wachtwoord').fill(oldSecret)
  await page.getByLabel('Nieuw wachtwoord', { exact: true }).fill(newSecret)
  await page.getByLabel('Nieuw wachtwoord herhalen').fill(newSecret)
  await page.getByRole('button', { name: 'Wachtwoord wijzigen' }).click()
  await page.waitForURL(/\/login\?wachtwoord=gewijzigd/)

  await other.goto('/dashboard')
  await expect(other).toHaveURL(/\/login/)

  await login(page, email, oldSecret)
  await expect(page).toHaveURL(/\/login/)
  await login(page, email, newSecret)
  await expect(page).not.toHaveURL(/\/login/)
})

test('wachtwoord vergeten: zelfde antwoord voor elk adres, link werkt één keer', async ({ browser }) => {
  const email = `e2e-reset-${run}@test.local`
  await register(await freshPage(browser), email, password('reset-oud'))

  const page = await freshPage(browser)
  await page.goto('/wachtwoord-vergeten')
  await page.getByLabel('E-mailadres').fill(`niemand-${run}@test.local`)
  await page.getByRole('button', { name: 'Herstellink versturen' }).click()
  await expect(page.getByRole('status')).toContainText('Als er een account bestaat')

  // De echte link gaat per mail; hier zetten we een gekende token in de database,
  // op dezelfde manier als de app (alleen de SHA-256-hash wordt bewaard).
  const token = randomBytes(32).toString('base64url')
  await db(async (client) => {
    const { rows } = await client.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email])
    await client.query(
      `INSERT INTO verification_tokens (identifier, token, expires) VALUES ($1, $2, now() + interval '1 hour')`,
      [`password-reset:${rows[0]?.id}`, createHash('sha256').update(token).digest('hex')],
    )
  })

  const fresh = password('reset-nieuw')
  await page.goto(`/wachtwoord-herstellen/${token}`)
  await page.getByLabel('Nieuw wachtwoord', { exact: true }).fill(fresh)
  await page.getByLabel('Nieuw wachtwoord herhalen').fill(fresh)
  await page.getByRole('button', { name: 'Wachtwoord opslaan' }).click()
  await expect(page.getByRole('status')).toContainText('Je wachtwoord is gewijzigd')

  await page.goto(`/wachtwoord-herstellen/${token}`)
  await expect(page.getByText('Deze link is verlopen of al gebruikt.')).toBeVisible()

  await login(page, email, fresh)
  await expect(page).not.toHaveURL(/\/login/)
})

test('AVG: gegevens downloaden en account definitief verwijderen', async ({ browser }) => {
  const email = `e2e-gdpr-${run}@test.local`
  const secret = password('gdpr')
  const page = await freshPage(browser)
  await register(page, email, secret)

  const exported = await page.request.get('/api/account/export')
  expect(exported.status()).toBe(200)
  expect(exported.headers()['content-disposition']).toContain('attachment')
  const body = await exported.text()
  expect(body).toContain(email)
  expect(body).not.toContain('passwordHash')

  await page.goto('/profile')
  await page.getByRole('button', { name: 'Account verwijderen…' }).click()
  await page.getByLabel('Typ je e-mailadres ter bevestiging').fill(email)
  await page.locator('#delete-password').fill(secret)
  await page.getByRole('button', { name: 'Definitief verwijderen' }).click()
  await page.waitForURL((url) => url.pathname === '/')

  const remaining = await db(async (client) =>
    (await client.query('SELECT count(*)::int AS n FROM users WHERE email = $1', [email])).rows[0]?.n,
  )
  expect(remaining).toBe(0)

  await login(page, email, secret)
  await expect(page).toHaveURL(/\/login/)
})

test('prijzen publiceren kan alleen een beheerder', async ({ browser }) => {
  const userPage = await freshPage(browser)
  await register(userPage, `e2e-noadmin-${run}@test.local`, password('noadmin'))
  await userPage.goto('/admin/prijzen')
  await expect(userPage).toHaveURL(/\/dashboard/)

  const page = await freshPage(browser)
  await login(page, ADMIN.email, ADMIN.password)
  await page.goto('/admin/prijzen')
  await expect(page.getByRole('heading', { name: 'Marktprijzen' })).toBeVisible()

  await page.getByLabel('Soort').selectOption('SILVER_PER_GRAM')
  await page.getByLabel('Waarde').fill('1.2345')
  await page.getByLabel('Bron').fill(`E2E-testbron ${run}`)
  await page.getByRole('button', { name: 'Publiceren' }).click()
  await expect(page.getByRole('status')).toHaveText('Gepubliceerd.')

  const row = page.getByRole('row', { name: /Zilver \(EUR\/g\)/ })
  await expect(row).toContainText('1.2345')
  await expect(row).toContainText('actueel')
})

test('publieke pagina’s en health checks', async ({ page }) => {
  for (const path of ['/privacy', '/voorwaarden']) {
    const response = await page.goto(path)
    expect(response?.status()).toBe(200)
  }
  await expect(page.getByRole('heading', { name: 'Gebruiksvoorwaarden' })).toBeVisible()

  expect((await page.request.get('/api/health')).status()).toBe(200)
  const ready = await page.request.get('/api/ready')
  expect(ready.status()).toBe(200)
  expect(await ready.json()).toEqual({ status: 'ready' })

  const missing = await page.goto('/bestaat-niet')
  expect(missing?.status()).toBe(404)
  await expect(page.getByText('Deze pagina bestaat niet')).toBeVisible()
})
