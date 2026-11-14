// Screenshots, accessibility checks (axe) and keyboard order for the running app.
//
// It needs the frontend (npm run dev) and the backend running. It uses a browser that is
// already installed (Microsoft Edge by default), so Playwright downloads no browser.
// Map tiles and every other request to another host are blocked, so nothing leaves this
// machine and the screenshots do not depend on the network.
//
// Usage (from frontend/):
//   npm run visual-check
//   BASE_URL=http://localhost:5180 API_URL=http://localhost:8010 npm run visual-check
//
// Options (environment variables, all optional):
//   BASE_URL    frontend address              (default http://localhost:5173)
//   API_URL     backend address               (default http://localhost:8000)
//   OUT_DIR     where the results go          (default ./visual-check, git-ignored)
//   PAGES       comma list of page names      (default: all, see PAGES below)
//   VIEWPORTS   mobile,desktop                (default: both)
//   THEMES      light,dark                    (default: both)
//   LANGS       pl,en                         (default: both)
//   CHANNEL     installed browser             (default msedge; chrome also works)
//
// Output in OUT_DIR:
//   <page>-<viewport>-<theme>-<lang>.png   one screenshot of the visible screen
//   axe.txt                                accessibility problems found by axe, per screen
//   aria-<page>-<viewport>-<lang>.txt      the accessibility tree as text (roles and names)
//   tab-<page>-<lang>.txt                  the first 30 stops of the Tab key on desktop

// The function given to page.evaluate() runs in the browser, where `document` exists.
/* global document */

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { AxeBuilder } from '@axe-core/playwright'
import { chromium } from 'playwright-core'

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:5173').replace(/\/$/, '')
const API_URL = (process.env.API_URL ?? 'http://localhost:8000').replace(/\/$/, '')
const OUT_DIR = path.resolve(process.env.OUT_DIR ?? 'visual-check')
const CHANNEL = process.env.CHANNEL ?? 'msedge'
const TAB_STOPS = 30

const VIEWPORTS = {
  // deviceScaleFactor 1 keeps the images small.
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1280, height: 800 } },
}

// Each page: a path and optional steps that bring it to the state worth checking.
const PAGES = {
  planner: { path: '/' },
  'planner-route': { path: '/', steps: clickFirstDemoRoute },
  'planner-trip': { path: '/', steps: planDemoTrip },
  walks: { path: '/walks' },
  'walk-detail': { path: '/walks', steps: openFirstWalk },
  profiles: { path: '/profiles' },
}

function pick(name, all) {
  const raw = process.env[name]
  return raw ? raw.split(',').map((item) => item.trim()) : all
}

async function loadTexts(lang) {
  const file = new URL(`../src/i18n/${lang}.json`, import.meta.url)
  return JSON.parse(await readFile(file, 'utf8'))
}

/**
 * Click and wait for the API answer. "networkidle" alone is not enough: it can fire before
 * the click has started the request, and the screenshot then shows the loading state.
 */
async function clickAndWaitFor(page, locator, apiPath) {
  const answer = page.waitForResponse((response) => response.url().includes(apiPath))
  await locator.click()
  await answer
  await page.waitForLoadState('networkidle')
}

async function clickFirstDemoRoute(page, texts) {
  const demo = page.getByRole('button', { name: texts.planner.demo.bigDetour }).first()
  await clickAndWaitFor(page, demo, '/api/route-plans/')
}

async function planDemoTrip(page, texts) {
  await page.getByRole('tab', { name: texts.planner.tabs.trip }).click()
  await page.getByRole('button', { name: texts.trip.form.demoStart }).click()
  const submit = page.getByRole('button', { name: texts.trip.form.submit })
  await clickAndWaitFor(page, submit, '/api/trip-ideas/')
}

async function openFirstWalk(page) {
  await page.locator('a[href^="/walks/"]').first().click()
  await page.waitForLoadState('networkidle')
}

/** Demo data for this run's client, so the walk pages are not empty. */
async function seedDemoData(request, clientId) {
  const response = await request.post(`${API_URL}/api/demo-data/`, {
    headers: { 'X-Client-Id': clientId },
  })
  if (!response.ok()) throw new Error(`demo-data answered ${response.status()}`)
}

async function newContext(browser, viewportName, theme, lang, clientId) {
  const context = await browser.newContext({ ...VIEWPORTS[viewportName], deviceScaleFactor: 1 })
  await context.addInitScript(
    ([themeValue, langValue, id]) => {
      localStorage.setItem('strollway.theme', themeValue)
      localStorage.setItem('strollway.language', langValue)
      localStorage.setItem('strollway.clientId', id)
    },
    [theme, lang, clientId],
  )
  // Only the app and its API: no map tiles, fonts or anything else from the internet.
  const allowed = [new URL(BASE_URL).host, new URL(API_URL).host]
  await context.route('**/*', (route) => {
    const host = new URL(route.request().url()).host
    return allowed.includes(host) ? route.continue() : route.abort()
  })
  return context
}

async function openPage(context, name, texts) {
  const page = await context.newPage()
  await page.goto(`${BASE_URL}${PAGES[name].path}`)
  await page.waitForLoadState('networkidle')
  if (PAGES[name].steps) await PAGES[name].steps(page, texts)
  return page
}

function formatAxe(label, violations) {
  if (violations.length === 0) return `${label}: no violations\n`
  const lines = violations.map((v) => {
    const targets = v.nodes
      .slice(0, 3)
      .map((node) => node.target.join(' '))
      .join(' | ')
    return `  - ${v.id} (${v.impact}, ${v.nodes.length}x): ${v.help}\n      ${targets}`
  })
  return `${label}: ${violations.length} rule(s)\n${lines.join('\n')}\n`
}

async function tabOrder(page) {
  const stops = []
  for (let i = 0; i < TAB_STOPS; i += 1) {
    await page.keyboard.press('Tab')
    stops.push(
      await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body) return '(body)'
        const name =
          el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 40) || el.tagName
        const role = el.getAttribute('role') || el.tagName.toLowerCase()
        return `${role}: ${name}`
      }),
    )
  }
  return stops.map((stop, i) => `${String(i + 1).padStart(2)}. ${stop}`).join('\n') + '\n'
}

async function main() {
  const pages = pick('PAGES', Object.keys(PAGES))
  const viewports = pick('VIEWPORTS', Object.keys(VIEWPORTS))
  const themes = pick('THEMES', ['light', 'dark'])
  const langs = pick('LANGS', ['pl', 'en'])
  await mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({ channel: CHANNEL, headless: true })
  const clientId = randomUUID()
  const seedContext = await browser.newContext()
  await seedDemoData(seedContext.request, clientId)
  await seedContext.close()

  let axeReport = ''
  try {
    for (const lang of langs) {
      const texts = await loadTexts(lang)
      for (const viewportName of viewports) {
        for (const theme of themes) {
          const context = await newContext(browser, viewportName, theme, lang, clientId)
          for (const name of pages) {
            const label = `${name}-${viewportName}-${theme}-${lang}`
            const page = await openPage(context, name, texts)
            await page.screenshot({ path: path.join(OUT_DIR, `${label}.png`) })
            const axe = await new AxeBuilder({ page }).analyze()
            axeReport += formatAxe(label, axe.violations)
            if (theme === themes[0]) {
              const tree = await page.locator('body').ariaSnapshot()
              await writeFile(path.join(OUT_DIR, `aria-${name}-${viewportName}-${lang}.txt`), tree)
            }
            if (theme === themes[0] && viewportName === 'desktop') {
              await page.goto(page.url()) // start the Tab walk from the top of the page
              await page.waitForLoadState('networkidle')
              await writeFile(path.join(OUT_DIR, `tab-${name}-${lang}.txt`), await tabOrder(page))
            }
            await page.close()
            console.log(`done: ${label}`)
          }
          await context.close()
        }
      }
    }
  } finally {
    await browser.close()
    await writeFile(path.join(OUT_DIR, 'axe.txt'), axeReport)
  }
  console.log(`Results in ${OUT_DIR}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
