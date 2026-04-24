import { expect, test } from '@playwright/test'

test('two tabs connect to same room and reach synced status', async ({ browser, page, baseURL }) => {
  await page.goto('/')
  await expect(page.locator('canvas').first()).toBeVisible()

  const roomHash = await page.evaluate(() => window.location.hash)
  expect(roomHash).toMatch(/^#[0-9a-f-]{36}$/i)

  const context = await browser.newContext()
  const peer = await context.newPage()

  await peer.goto(`${baseURL}/${roomHash}`)
  await expect(peer.locator('canvas').first()).toBeVisible()
  await expect
    .poll(async () => peer.evaluate(() => window.location.hash))
    .toBe(roomHash)

  // Debug panel is rendered in dev and includes ws status.
  await expect(page.getByText(/ws:\s*SYNCED/i)).toBeVisible()
  await expect(peer.getByText(/ws:\s*SYNCED/i)).toBeVisible()

  await peer.close()
  await context.close()
})
