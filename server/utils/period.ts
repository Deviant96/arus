import type { H3Event } from 'h3'
import { zPeriodQuery } from '../../shared/schemas/common'
import type { DateRange } from '../../shared/utils/dates'
import { resolvePeriod } from '../../shared/utils/dates'
import { validatedQuery } from './http'

/** Parse ?period=...&startDate=&endDate= into a concrete date range. */
export function periodFromQuery(event: H3Event, timezone: string): DateRange {
  const q = validatedQuery(event, zPeriodQuery)
  return resolvePeriod(q.period, timezone, { startDate: q.startDate, endDate: q.endDate })
}
