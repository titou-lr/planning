import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const supabaseUrl = process.env.E2E_SUPABASE_URL
const publishableKey = process.env.E2E_SUPABASE_PUBLISHABLE_KEY
const email = process.env.E2E_SUPABASE_TEST_EMAIL
const password = process.env.E2E_SUPABASE_TEST_PASSWORD

interface AuthSession {
  access_token: string
  refresh_token: string
  expires_in: number
  expires_at: number
  token_type: string
  user: unknown
}

async function passwordSession(): Promise<AuthSession> {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: publishableKey!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) throw new Error(`Supabase Auth test failed (${response.status}): ${await response.text()}`)
  const session = await response.json() as AuthSession
  session.expires_at = Math.floor(Date.now() / 1000) + session.expires_in
  return session
}

async function seedSession(context: BrowserContext, session: AuthSession): Promise<void> {
  const projectRef = new URL(supabaseUrl!).hostname.split('.')[0]
  await context.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value))
  }, { key: `sb-${projectRef}-auth-token`, value: session })
}

async function createProfile(page: Page, name: string): Promise<void> {
  await page.goto('/')
  await page.getByPlaceholder('ex. Perso').fill(name)
  await page.getByRole('button', { name: 'Créer le profil' }).click()
  await expect(page.getByText('Synchronisé', { exact: true })).toBeVisible({ timeout: 20_000 })
}

test('deux appareils convergent via le journal Supabase', async ({ browser }) => {
  test.skip(!supabaseUrl || !publishableKey || !email || !password, 'Identifiants du compte cloud de test absents')
  const session = await passwordSession()
  const first = await browser.newContext()
  const second = await browser.newContext()
  await seedSession(first, session)
  await seedSession(second, session)

  const firstPage = await first.newPage()
  await createProfile(firstPage, 'Cloud appareil 1')
  await firstPage.getByRole('button', { name: 'Nouvelle page', exact: true }).click()
  await firstPage.getByPlaceholder('Sans titre').fill('Convergence Supabase validée')

  await firstPage.getByText('Tâches', { exact: true }).click()
  await firstPage.getByRole('button', { name: 'Tâche', exact: true }).click()
  await firstPage.getByPlaceholder('Titre de la tâche').fill('Fichier cloud validé')
  const fileChooser = firstPage.waitForEvent('filechooser')
  await firstPage.getByRole('button', { name: 'Joindre' }).click()
  await (await fileChooser).setFiles({
    name: 'preuve-cloud.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('stockage privé Supabase validé'),
  })
  await expect(firstPage.getByText('preuve-cloud.txt', { exact: true })).toBeVisible()

  await firstPage.getByText('Réglages', { exact: true }).click()
  await firstPage.getByRole('button', { name: 'Synchroniser maintenant' }).click()
  await expect(firstPage.getByText('Synchronisé', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
  await expect.poll(() => firstPage.getByText('preuve-cloud.txt', { exact: true }).getAttribute('href')).toMatch(/^blob:/)

  const secondPage = await second.newPage()
  await createProfile(secondPage, 'Cloud appareil 2')
  await expect(secondPage.getByText('Convergence Supabase validée', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
  await secondPage.getByText('Tâches', { exact: true }).click()
  await expect(secondPage.getByText('Fichier cloud validé', { exact: true })).toBeVisible({ timeout: 20_000 })
  await secondPage.getByText('Fichier cloud validé', { exact: true }).click()
  const attachment = secondPage.getByText('preuve-cloud.txt', { exact: true })
  await expect(attachment).toBeVisible()
  await expect.poll(() => attachment.getAttribute('href')).toMatch(/^blob:/)

  await first.close()
  await second.close()
})
