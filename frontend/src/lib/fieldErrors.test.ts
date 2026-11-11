import i18n from '@/i18n'
import { ApiError } from '@/api/client'
import { errorMessage, parseFieldErrors } from './fieldErrors'

const FIELDS = ['name', 'children_ages'] as const

describe('parseFieldErrors', () => {
  it('puts DRF messages next to known fields and the rest in general', () => {
    const error = new ApiError(400, 'HTTP 400', {
      name: ['This field may not be blank.'],
      children_ages: 'Give between 1 and 6 ages.',
      stops: [{}, { planned_minutes: ['Ensure this value is less than or equal to 120.'] }],
      non_field_errors: ['Something general.'],
    })
    expect(parseFieldErrors(error, FIELDS)).toEqual({
      fields: {
        name: 'This field may not be blank.',
        children_ages: 'Give between 1 and 6 ages.',
      },
      general: 'Ensure this value is less than or equal to 120. Something general.',
    })
  })

  it('ignores errors that are not a 400', () => {
    expect(parseFieldErrors(new ApiError(500, 'HTTP 500'), FIELDS)).toEqual({
      fields: {},
      general: null,
    })
    expect(parseFieldErrors(new Error('boom'), FIELDS).general).toBeNull()
  })
})

it('translates a failed request', () => {
  const t = i18n.t.bind(i18n)
  expect(errorMessage(t, new ApiError(0, 'down'))).toBe('No connection to the server.')
  expect(errorMessage(t, new ApiError(503, 'HTTP 503'))).toBe('The server returned error 503.')
  expect(errorMessage(t, new Error('boom'))).toBe('Something went wrong.')
})
