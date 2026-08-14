import type { EventHandler, EventHandlerRequest, H3Event } from 'h3'
import { createError, defineEventHandler } from 'h3'
import { DomainError } from '../services/errors'

/**
 * Wraps an API handler so DomainErrors from services become clean HTTP
 * errors, and unexpected errors become a generic 500 without leaking
 * internals to the client.
 */
export function defineApiHandler<T extends EventHandlerRequest, D>(handler: (event: H3Event<T>) => Promise<D>): EventHandler<T, Promise<D>> {
  return defineEventHandler(async (event) => {
    try {
      return await handler(event)
    }
    catch (err: any) {
      if (err instanceof DomainError) {
        throw createError({
          statusCode: err.statusCode,
          statusMessage: err.message,
          data: err.fields ? { fields: err.fields } : undefined,
        })
      }
      // h3 errors (createError) pass through untouched
      if (err && typeof err === 'object' && 'statusCode' in err) throw err
      console.error('[api] unexpected error:', err?.message ?? err)
      throw createError({
        statusCode: 500,
        statusMessage: 'Something went wrong on our side. Please try again.',
      })
    }
  })
}
