import { BaseError, UnexpectedErrorStructureError } from '@/modules/shared/errors'

/**
 * In JS catch clauses can receive not only Errors, but pretty much any other kind of data type, so
 * you can use this helper to ensure that whatever is passed in is a real error
 */
export function ensureError(
  e: Error | unknown,
  fallbackMessage?: string
): Error | BaseError {
  if (e instanceof Error) return e
  return new UnexpectedErrorStructureError(fallbackMessage, {
    info: {
      originalError: e
    }
  })
}
