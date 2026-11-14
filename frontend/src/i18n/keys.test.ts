import en from './en.json'
import pl from './pl.json'

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? keys(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )
}

it('pl.json and en.json have the same keys', () => {
  expect(keys(pl).sort()).toEqual(keys(en).sort())
})

// Every source file as text (Vite reads them at test time), without tests and generated types.
const sources = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.*', '!../api/schema.d.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

it('every fixed key used in the code exists in en.json', () => {
  const known = new Set(keys(en))
  // t('a.b') or i18nKey="a.b"; keys built with ${...} cannot be checked this way.
  const used = Object.values(sources).flatMap((code) =>
    [...code.matchAll(/\bt\(\s*'([\w.]+)'|i18nKey="([\w.]+)"/g)].map((m) => m[1] ?? m[2]),
  )
  expect(used.length).toBeGreaterThan(50) // the scan really found the code
  // Plural keys exist as key_one / key_other.
  const missing = used.filter((key) => !known.has(key) && !known.has(`${key}_one`))
  expect([...new Set(missing)]).toEqual([])
})
