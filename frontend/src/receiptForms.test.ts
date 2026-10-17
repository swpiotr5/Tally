import { describe, expect, it } from 'vitest'

import { ApiError } from './api'
import {
  itemChanges,
  itemFormValues,
  receiptChanges,
  receiptFormValues,
  saveErrorMessage,
} from './receiptForms'
import { receipt } from './test/fixtures'

const milk = receipt.items[0]

describe('item form', () => {
  it('starts with the saved values written the Polish way', () => {
    expect(itemFormValues(milk)).toEqual({
      raw_name: 'MLEKO 2% 1L',
      category: 'dairy',
      quantity: '2',
      unit_price: '3,49',
      total_price: '6,98',
      discount: '0,50',
    })
  })

  it('reports no changes for an untouched form', () => {
    expect(itemChanges(milk, itemFormValues(milk))).toEqual({ changes: {}, errors: {} })
  })

  it('returns only the changed fields, amounts as decimal strings', () => {
    const values = { ...itemFormValues(milk), category: 'drinks' as const, unit_price: '3,79' }

    expect(itemChanges(milk, values)).toEqual({
      changes: { category: 'drinks', unit_price: '3.79' },
      errors: {},
    })
  })

  it('treats the same number written differently as unchanged', () => {
    const values = { ...itemFormValues(milk), quantity: '2,000', total_price: '6.98' }

    expect(itemChanges(milk, values).changes).toEqual({})
  })

  it('trims the name', () => {
    const values = { ...itemFormValues(milk), raw_name: '  MLEKO 3,2% 1L ' }

    expect(itemChanges(milk, values).changes).toEqual({ raw_name: 'MLEKO 3,2% 1L' })
  })

  it('explains every invalid field', () => {
    const values = {
      ...itemFormValues(milk),
      raw_name: ' ',
      quantity: '0',
      unit_price: 'abc',
      total_price: '3,499',
      discount: '-1',
    }

    expect(Object.keys(itemChanges(milk, values).errors).sort()).toEqual([
      'discount',
      'quantity',
      'raw_name',
      'total_price',
      'unit_price',
    ])
  })
})

describe('receipt header form', () => {
  it('reports no changes for an untouched form', () => {
    expect(receiptChanges(receipt, receiptFormValues(receipt))).toEqual({
      changes: {},
      errors: {},
    })
  })

  it('accepts a NIP typed with separators', () => {
    const values = { ...receiptFormValues(receipt), store_nip: '526-025-09-95' }

    expect(receiptChanges(receipt, values).changes).toEqual({ store_nip: '5260250995' })
  })

  it('removes the NIP when the field is cleared', () => {
    const values = { ...receiptFormValues(receipt), store_nip: '' }

    expect(receiptChanges(receipt, values).changes).toEqual({ store_nip: null })
  })

  it('changes the store, date and total', () => {
    const values = {
      ...receiptFormValues(receipt),
      store_name: 'Lidl',
      purchase_date: '2026-10-16',
      total: '10,18',
    }

    expect(receiptChanges(receipt, values).changes).toEqual({
      store_name: 'Lidl',
      purchase_date: '2026-10-16',
      total: '10.18',
    })
  })

  it('explains every invalid field', () => {
    const values = { store_name: '', store_nip: '123', purchase_date: '', total: 'x' }

    expect(Object.keys(receiptChanges(receipt, values).errors).sort()).toEqual([
      'purchase_date',
      'store_name',
      'store_nip',
      'total',
    ])
  })
})

describe('saveErrorMessage', () => {
  it.each([
    [new ApiError(422, 'invalid'), 'Sprawdź wpisane wartości'],
    [new ApiError(404, 'gone'), 'Odśwież stronę'],
    [new ApiError(500, 'boom'), 'Nie udało się zapisać'],
    [new TypeError('Failed to fetch'), 'Brak połączenia'],
  ])('describes %s', (error, expected) => {
    expect(saveErrorMessage(error)).toContain(expected)
  })
})
