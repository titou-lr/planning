import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

function expectWorkspaceReady(page: Page) {
  return Promise.all([
    expect(page.getByRole('banner').getByText('Accueil', { exact: true })).toBeVisible(),
    expect(page.getByRole('button', { name: 'Nouvelle page', exact: true })).toBeVisible(),
    expect(page.getByRole('button', { name: 'Nouvelle base de données', exact: true })).toBeVisible(),
  ])
}

test('crée un profil et ouvre le workspace', async ({ page }) => {
  await expect(page.getByText(/Qui utilise l.app/)).toBeVisible()
  await page.getByPlaceholder('ex. Perso').fill('Migration test')
  await page.getByRole('button', { name: 'Créer le profil' }).click()

  await expectWorkspaceReady(page)
})

test('reste exploitable après un rechargement', async ({ page }) => {
  await page.getByPlaceholder('ex. Perso').fill('Persistance test')
  await page.getByRole('button', { name: 'Créer le profil' }).click()
  await expectWorkspaceReady(page)

  await page.reload()

  await expectWorkspaceReady(page)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('suite-profiles')))
    .toContain('Persistance test')
})

test('conserve les données locales après fermeture forcée de la page', async ({ page, context }) => {
  await page.getByPlaceholder('ex. Perso').fill('Fermeture forcée')
  await page.getByRole('button', { name: 'Créer le profil' }).click()
  await expectWorkspaceReady(page)

  await page.close({ runBeforeUnload: false })
  const reopened = await context.newPage()
  await reopened.goto('/')

  await expect(reopened.getByText('Fermeture forcée', { exact: true })).toBeVisible()
  await reopened.getByText('Fermeture forcée', { exact: true }).click()
  await expectWorkspaceReady(reopened)
  await expect.poll(() => reopened.evaluate(() => localStorage.getItem('suite-profiles')))
    .toContain('Fermeture forcée')
})
