/**
 * Domain error that services throw; API handlers translate it into an HTTP
 * error. Keeping services free of h3 imports keeps them unit-testable.
 */
export class DomainError extends Error {
  statusCode: number
  fields?: Record<string, string>

  constructor(message: string, statusCode = 400, fields?: Record<string, string>) {
    super(message)
    this.name = 'DomainError'
    this.statusCode = statusCode
    this.fields = fields
  }
}

export function domainNotFound(entity = 'Record'): never {
  throw new DomainError(`${entity} not found`, 404)
}
