import type { H3Event } from 'h3'
import type { ZodType } from 'zod'
import { createError, getQuery, readBody } from 'h3'

/**
 * Validate a request body against a Zod schema, returning a clean 422 with
 * field-level messages on failure (never a raw stack trace).
 */
export async function validatedBody<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  const body = await readBody(event).catch(() => null)
  const result = schema.safeParse(body ?? {})
  if (!result.success) {
    const fields: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || '_'
      if (!fields[path]) fields[path] = issue.message
    }
    throw createError({
      statusCode: 422,
      statusMessage: 'Validation failed',
      data: { fields },
    })
  }
  return result.data
}

export function validatedQuery<T>(event: H3Event, schema: ZodType<T>): T {
  const query = getQuery(event)
  const result = schema.safeParse(query)
  if (!result.success) {
    const fields: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || '_'
      if (!fields[path]) fields[path] = issue.message
    }
    throw createError({ statusCode: 422, statusMessage: 'Invalid query', data: { fields } })
  }
  return result.data
}

export function notFound(message = 'Not found'): never {
  throw createError({ statusCode: 404, statusMessage: message })
}

export function badRequest(message: string, fields?: Record<string, string>): never {
  throw createError({ statusCode: 400, statusMessage: message, data: fields ? { fields } : undefined })
}

export function forbidden(message = 'You do not have access to this resource'): never {
  throw createError({ statusCode: 403, statusMessage: message })
}
