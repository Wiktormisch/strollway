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
