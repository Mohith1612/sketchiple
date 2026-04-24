import { expect, type Page, test } from '@playwright/test'

async function waitForSynced(page: Page): Promise<void> {
  await expect(page.getByText(/ws:\s*SYNCED/i)).toBeVisible()
}

async function getShapesCount(page: Page): Promise<number> {
  const text = await page.getByText(/^shapes:\s*\d+$/).first().innerText()
  const match = text.match(/\d+/)
  if (!match) throw new Error(`Could not parse shapes count from: ${text}`)
  return Number(match[0])
}

async function drawRect(page: Page): Promise<void> {
  await page.getByRole('button', { name: /rect/i }).click()
  const canvas = page.locator('canvas').first()
  await expect(canvas).toBeVisible()

  const box = await canvas.boundingBox()
  if (!box) throw new Error('Missing canvas bounding box')

  const startX = box.x + 120
  const startY = box.y + 120
  const endX = startX + 120
  const endY = startY + 80

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(endX, endY)
  await page.mouse.up()
}

test('drawing syncs between two tabs', async ({ browser, page, baseURL }) => {
  await page.goto('/')
  const roomHash = await page.evaluate(() => window.location.hash)

  const context = await browser.newContext()
  const peer = await context.newPage()
  await peer.goto(`${baseURL}/${roomHash}`)

  await waitForSynced(page)
  await waitForSynced(peer)

  await drawRect(page)

  await expect
    .poll(async () => getShapesCount(page))
    .toBeGreaterThan(0)

  await expect
    .poll(async () => getShapesCount(peer))
    .toBeGreaterThan(0)

  await peer.close()
  await context.close()
})

test('undo and redo toolbar flow works', async ({ page }) => {
  await page.goto('/')
  await waitForSynced(page)

  await drawRect(page)

  const undoButton = page.getByRole('button', { name: /undo/i })
  const redoButton = page.getByRole('button', { name: /redo/i })

  await expect(undoButton).toBeEnabled()

  await undoButton.click()
  await expect(redoButton).toBeEnabled()

  await redoButton.click()
  await expect(undoButton).toBeEnabled()
})

test('json export starts a download', async ({ page }) => {
  await page.goto('/')
  await waitForSynced(page)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /^↓ json$/i }).click()
  const download = await downloadPromise

  const filename = download.suggestedFilename()
  expect(filename).toMatch(/\.json$/i)
})

test('svg export starts a download', async ({ page }) => {
  await page.goto('/')
  await waitForSynced(page)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /^↓ svg$/i }).click()
  const download = await downloadPromise

  const filename = download.suggestedFilename()
  expect(filename).toMatch(/\.svg$/i)
})

test('reload reconnects and keeps room hash', async ({ page }) => {
  await page.goto('/')
  await waitForSynced(page)

  const roomHash = await page.evaluate(() => window.location.hash)

  await page.reload()
  await waitForSynced(page)

  await expect
    .poll(async () => page.evaluate(() => window.location.hash))
    .toBe(roomHash)
})
