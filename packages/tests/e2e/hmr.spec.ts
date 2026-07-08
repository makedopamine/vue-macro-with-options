import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createServer, type ViteDevServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { chromium, type Browser, type Page } from 'playwright'
import { compiler } from 'vue-macro-with-options'

const fixtureDir = path.resolve('e2e/hmr-fixture')
const appVuePath = path.join(fixtureDir, 'App.vue')

let originalContent: string
let server: ViteDevServer
let browser: Browser
let page: Page
let url: string

beforeAll(async () => {
  originalContent = await fs.readFile(appVuePath, 'utf8')

  server = await createServer({
    configFile: false,
    root: fixtureDir,
    logLevel: 'silent',
    plugins: [vue({ compiler })],
    server: { port: 0 },
  })
  await server.listen()
  const resolved = server.resolvedUrls?.local[0]
  if (!resolved) {
    throw new Error('Vite dev server did not resolve a local URL')
  }
  url = resolved

  browser = await chromium.launch({ channel: 'chrome' })
  page = await browser.newPage()
}, 30000)

afterAll(async () => {
  await page?.close()
  await browser?.close()
  await server?.close()
  await fs.writeFile(appVuePath, originalContent, 'utf8')
})

describe('hmr', () => {
  test('changing a prop default hot-updates the component without a full reload', async () => {
    const hmrMessages: string[] = []
    page.on('console', (msg) => {
      const text = msg.text()
      if (text.includes('hot updated') || text.includes('page reload')) {
        hmrMessages.push(text)
      }
    })

    await page.goto(url)
    await expect.poll(() => page.textContent('#value')).toBe('1')

    const updatedContent = originalContent.replace('default: 1,', 'default: 2,')
    await fs.writeFile(appVuePath, updatedContent, 'utf8')

    await expect.poll(() => page.textContent('#value'), { timeout: 5000 }).toBe('2')

    expect(hmrMessages.some((msg) => msg.includes('hot updated'))).toBe(true)
    expect(hmrMessages.some((msg) => msg.includes('page reload'))).toBe(false)
  }, 20000)
})
