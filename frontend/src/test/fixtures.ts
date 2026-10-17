import type { Receipt, ReceiptSummary } from '../api'

export const receipt: Receipt = {
  id: 1,
  store_name: 'Biedronka',
  store_nip: '7791011327',
  purchase_date: '2026-10-17',
  total: '9.68',
  status: 'ok',
  created_at: '2026-10-17T19:01:31Z',
  items: [
    {
      id: 1,
      raw_name: 'MLEKO 2% 1L',
      quantity: '2.000',
      unit_price: '3.49',
      total_price: '6.98',
      discount: '0.50',
      category: 'dairy',
    },
    {
      id: 2,
      raw_name: 'BANANY LUZ',
      quantity: '0.535',
      unit_price: '5.99',
      total_price: '3.20',
      discount: '0.00',
      category: 'fruits_vegetables',
    },
  ],
}

export const summary: ReceiptSummary = {
  id: 1,
  store_name: 'Biedronka',
  purchase_date: '2026-10-17',
  total: '9.68',
  status: 'ok',
  created_at: '2026-10-17T19:01:31Z',
  item_count: 2,
}

export function photo(name = 'paragon.jpg', type = 'image/jpeg'): File {
  return new File(['fake image bytes'], name, { type })
}
