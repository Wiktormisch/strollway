import { formatDate, formatDistance, formatDuration } from './format'

describe('formatDistance', () => {
  it('shows metres below 1 km, rounded', () => {
    expect(formatDistance(0)).toBe('0 m')
    expect(formatDistance(16.4)).toBe('16 m')
    expect(formatDistance(999.4)).toBe('999 m')
  })

  it('shows kilometres from 1 km, with one decimal in the locale format', () => {
    expect(formatDistance(1000)).toBe('1 km')
    expect(formatDistance(1234)).toBe('1.2 km')
    expect(formatDistance(1234, 'pl')).toBe('1,2 km')
  })
})

describe('formatDuration', () => {
  it('shows minutes below one hour', () => {
    expect(formatDuration(0)).toBe('0 min')
    expect(formatDuration(6.4)).toBe('6 min')
    expect(formatDuration(59)).toBe('59 min')
  })

  it('shows hours with zero-padded minutes', () => {
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(65)).toBe('1 h 05 min')
    expect(formatDuration(130)).toBe('2 h 10 min')
  })

  it('never shows negative time', () => {
    expect(formatDuration(-3)).toBe('0 min')
  })
})

describe('formatDate', () => {
  // Midday UTC keeps the same day in every time zone the tests may run in.
  it('uses a short month in the given language', () => {
    expect(formatDate('2026-03-05T12:00:00Z', 'en')).toBe('Mar 5, 2026')
    expect(formatDate('2026-03-05T12:00:00Z', 'pl')).toBe('5 mar 2026')
  })
})
