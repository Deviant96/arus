import { describe, expect, it } from 'vitest'
import { formatAmountPlain, formatMoney, parseAmountToMinor, percentOf, splitEvenly } from '../shared/utils/money'

describe('parseAmountToMinor', () => {
  it('parses IDR grouping separators without treating them as decimals', () => {
    expect(parseAmountToMinor('50000', 'IDR')).toBe(50_000)
    expect(parseAmountToMinor('1.250.000', 'IDR')).toBe(1_250_000)
    expect(parseAmountToMinor('1,250,000', 'IDR')).toBe(1_250_000)
    expect(parseAmountToMinor('Rp 35.000', 'IDR')).toBe(35_000)
  })

  it('parses 2-decimal currencies without float drift', () => {
    expect(parseAmountToMinor('12.50', 'USD')).toBe(1250)
    expect(parseAmountToMinor('12,50', 'EUR')).toBe(1250)
    expect(parseAmountToMinor('1,250.50', 'USD')).toBe(125050)
    expect(parseAmountToMinor('0.01', 'USD')).toBe(1)
  })

  it('rejects negatives and empty input', () => {
    expect(parseAmountToMinor('', 'IDR')).toBeNull()
    expect(parseAmountToMinor('-5000', 'IDR')).toBeNull()
    expect(parseAmountToMinor('abc', 'IDR')).toBeNull()
  })
})

describe('splitEvenly', () => {
  it('splits a total into parts that sum exactly, remainder on last', () => {
    expect(splitEvenly(10_000_000, 12).reduce((a, b) => a + b, 0)).toBe(10_000_000)
    expect(splitEvenly(100, 3)).toEqual([33, 33, 34])
    expect(splitEvenly(16_900_000, 12)[11]).toBe(16_900_000 - Math.floor(16_900_000 / 12) * 11)
  })

  it('rejects invalid inputs', () => {
    expect(() => splitEvenly(-1, 3)).toThrow()
    expect(() => splitEvenly(10, 0)).toThrow()
  })
})

describe('percentOf / formatMoney', () => {
  it('returns 0 when the whole is 0', () => {
    expect(percentOf(100, 0)).toBe(0)
  })

  it('formats IDR with no decimals', () => {
    expect(formatMoney(1_250_000, 'IDR')).toMatch(/1[.\s]?250[.\s]?000/)
    expect(formatAmountPlain(1_250_000, 'IDR')).toMatch(/1[.\s]?250[.\s]?000/)
  })
})
