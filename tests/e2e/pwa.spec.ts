import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Contrôles PWA exécutés une seule fois sur Chromium desktop')
  await page.goto('/')
})

async function createProfile(page: import('@playwright/test').Page) {
  await page.getByPlaceholder('ex. Perso').fill('PWA test')
  await page.getByRole('button', { name: 'Créer le profil' }).click()
  await expect(page.getByRole('button', { name: 'Nouvelle page', exact: true })).toBeVisible()
}

test('expose un manifeste installable et un service worker actif', async ({ page }) => {
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(manifestHref).toBeTruthy()
  const manifest = await page.evaluate(async (href) => {
    const response = await fetch(href as string)
    return response.json() as Promise<{ name: string; display: string; icons: unknown[] }>
  }, manifestHref)

  expect(manifest).toMatchObject({ name: 'Planning', display: 'standalone' })
  expect(manifest.icons).not.toHaveLength(0)
  await expect.poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.ready))).toBe(true)
})

test('reste utilisable hors ligne après la première visite', async ({ page, context }) => {
  await createProfile(page)
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Nouvelle page', exact: true })).toBeVisible()

  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('button', { name: 'Nouvelle page', exact: true })).toBeVisible()
})

test('migre le workspace vers IndexedDB et conserve un deep link', async ({ page }) => {
  await createProfile(page)
  await page.getByRole('button', { name: 'Nouvelle page', exact: true }).click()
  await page.getByPlaceholder('Sans titre').fill('Persistée dans IndexedDB')
  await expect(page).toHaveURL(/#\/notes\//)

  await expect.poll(() => page.evaluate(() => {
    const profiles = JSON.parse(localStorage.getItem('suite-profiles') ?? '[]') as { id: string }[]
    const raw = localStorage.getItem(`suite-data-${profiles[0]?.id ?? ''}`)
    if (!raw) return false
    const persisted = JSON.parse(raw) as { state?: { data?: unknown } }
    return persisted.state?.data === undefined
  })).toBe(true)

  const deepLink = page.url()
  await page.goto(deepLink)

  await expect(page.getByPlaceholder('Sans titre')).toHaveValue('Persistée dans IndexedDB')
})
