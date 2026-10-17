import { describe, expect, it } from 'vitest'

import {
  formatDate,
  formatDateTime,
  formatItemCount,
  formatMoney,
  formatNip,
  formatQuantity,
  formatReceiptCount,
} from './format'
import { plain } from './test/utils'

describe('formatMoney', () => {
  it.each([
    ['23.40', '23,40 zł'],
    ['0.5', '0,50 zł'],
    ['12345.67', '12 345,67 zł'],
  ])('formats %s as %s', (amount, expected) => {
    expect(plain(formatMoney(amount))).toBe(expected)
  })
})

describe('formatQuantity', () => {
  it.each([
    ['2.000', '2 szt.'],
    ['1', '1 szt.'],
    ['0.742', '0,742 kg'],
    ['1.500', '1,5 kg'],
  ])('formats %s as %s', (quantity, expected) => {
    expect(formatQuantity(quantity)).toBe(expected)
  })
})

describe('formatDate', () => {
  it('uses a short month by default', () => {
    expect(formatDate('2026-10-17')).toBe('17 paź 2026')
  })

  it('can spell the month out', () => {
    expect(formatDate('2026-10-17', 'long')).toBe('17 października 2026')
  })

  it('keeps the first day of the month on the same day', () => {
    expect(formatDate('2026-01-01', 'long')).toBe('1 stycznia 2026')
  })
})

describe('formatDateTime', () => {
  it('shows the date and time in the local time zone', () => {
    expect(plain(formatDateTime('2026-10-17T19:01:31Z'))).toBe('17 paź 2026, 19:01')
  })
})

describe('formatNip', () => {
  it('groups the digits like a printed NIP', () => {
    expect(formatNip('1234563218')).toBe('123-456-32-18')
  })

  it('leaves unexpected values unchanged', () => {
    expect(formatNip('12345')).toBe('12345')
  })
})

describe('Polish plurals', () => {
  it.each([
    [0, '0 pozycji'],
    [1, '1 pozycja'],
    [2, '2 pozycje'],
    [4, '4 pozycje'],
    [5, '5 pozycji'],
    [12, '12 pozycji'],
    [22, '22 pozycje'],
    [25, '25 pozycji'],
  ])('formats %i items as "%s"', (count, expected) => {
    expect(formatItemCount(count)).toBe(expected)
  })

  it.each([
    [1, '1 paragon'],
    [3, '3 paragony'],
    [11, '11 paragonów'],
  ])('formats %i receipts as "%s"', (count, expected) => {
    expect(formatReceiptCount(count)).toBe(expected)
  })
})
