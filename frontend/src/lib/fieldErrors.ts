import type { TFunction } from 'i18next'
import { ApiError } from '@/api/client'

export interface FormErrors {
  /** Messages for fields the form shows, by field name. */
  fields: Record<string, string>
  /** Everything else, for a toast. null when there is nothing to show. */
  general: string | null
}

export const NO_ERRORS: FormErrors = { fields: {}, general: null }

/** Collects every string from a DRF error value: a string, a list, or nested objects. */
function messages(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(messages)
  if (value && typeof value === 'object') return Object.values(value).flatMap(messages)
  return []
}

/**
 * Turns a DRF 400 body into messages next to the right fields.
 * Errors for fields the form does not show go to `general`, so nothing is lost.
 * Backend messages are English only; the UI shows them as they are.
 */
export function parseFieldErrors(error: unknown, knownFields: readonly string[]): FormErrors {
  if (!(error instanceof ApiError) || error.status !== 400) return NO_ERRORS
  const body = error.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { fields: {}, general: messages(body).join(' ') || null }
  }
  const fields: Record<string, string> = {}
  const general: string[] = []
  for (const [key, value] of Object.entries(body)) {
    const text = messages(value).join(' ')
    if (!text) continue
    if (knownFields.includes(key)) fields[key] = text
    else general.push(text)
  }
  return { fields, general: general.length > 0 ? general.join(' ') : null }
}

/** A short, translated message for a failed request (for a toast or a banner). */
export function errorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return t('errors.network')
    return t('errors.http', { status: error.status })
  }
  return t('errors.unknown')
}
