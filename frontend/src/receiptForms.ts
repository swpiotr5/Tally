import {
  ApiError,
  type Category,
  type Receipt,
  type ReceiptChanges,
  type ReceiptItem,
  type ReceiptItemChanges,
} from './api'
import { formatNip, parseDecimalInput, toMoneyInput, toQuantityInput } from './format'

// Form state is the text the user typed; it becomes API values only when saving. Typed
// numbers are compared with saved ones only to skip unchanged fields ("2" vs "2.000"),
// and are sent exactly as typed.

export type FormErrors<Values> = Partial<Record<keyof Values, string>>

interface FormResult<Changes, Values> {
  changes: Changes
  errors: FormErrors<Values>
}

const MONEY_ERROR = 'Wpisz kwotę, np. 3,49'

export interface ItemFormValues {
  raw_name: string
  category: Category
  quantity: string
  unit_price: string
  total_price: string
  discount: string
}

export function itemFormValues(item: ReceiptItem): ItemFormValues {
  return {
    raw_name: item.raw_name,
    category: item.category,
    quantity: toQuantityInput(item.quantity),
    unit_price: toMoneyInput(item.unit_price),
    total_price: toMoneyInput(item.total_price),
    discount: toMoneyInput(item.discount),
  }
}

/** Validate the item form and return only the fields that differ from the saved item. */
export function itemChanges(
  item: ReceiptItem,
  values: ItemFormValues,
): FormResult<ReceiptItemChanges, ItemFormValues> {
  const changes: ReceiptItemChanges = {}
  const errors: FormErrors<ItemFormValues> = {}

  const name = values.raw_name.trim()
  if (!name) {
    errors.raw_name = 'Wpisz nazwę pozycji'
  } else if (name !== item.raw_name) {
    changes.raw_name = name
  }

  if (values.category !== item.category) {
    changes.category = values.category
  }

  const quantity = parseDecimalInput(values.quantity, 3)
  if (quantity === null || Number(quantity) <= 0) {
    errors.quantity = 'Wpisz ilość, np. 1 lub 0,535'
  } else if (Number(quantity) !== Number(item.quantity)) {
    changes.quantity = quantity
  }

  for (const field of ['unit_price', 'total_price', 'discount'] as const) {
    const amount = parseDecimalInput(values[field], 2)
    if (amount === null) {
      errors[field] = MONEY_ERROR
    } else if (Number(amount) !== Number(item[field])) {
      changes[field] = amount
    }
  }

  return { changes, errors }
}

export interface ReceiptFormValues {
  store_name: string
  store_nip: string
  purchase_date: string
  total: string
}

export function receiptFormValues(receipt: Receipt): ReceiptFormValues {
  return {
    store_name: receipt.store_name,
    store_nip: receipt.store_nip ? formatNip(receipt.store_nip) : '',
    purchase_date: receipt.purchase_date,
    total: toMoneyInput(receipt.total),
  }
}

/** Validate the header form and return only the fields that differ from the saved receipt. */
export function receiptChanges(
  receipt: Receipt,
  values: ReceiptFormValues,
): FormResult<ReceiptChanges, ReceiptFormValues> {
  const changes: ReceiptChanges = {}
  const errors: FormErrors<ReceiptFormValues> = {}

  const name = values.store_name.trim()
  if (!name) {
    errors.store_name = 'Wpisz nazwę sklepu'
  } else if (name !== receipt.store_name) {
    changes.store_name = name
  }

  // Separators are fine ("779-101-13-27"); an empty field removes the NIP.
  const digits = values.store_nip.replace(/\D/g, '')
  if (digits && digits.length !== 10) {
    errors.store_nip = 'NIP ma 10 cyfr'
  } else if ((digits || null) !== receipt.store_nip) {
    changes.store_nip = digits || null
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.purchase_date)) {
    errors.purchase_date = 'Wybierz datę zakupu'
  } else if (values.purchase_date !== receipt.purchase_date) {
    changes.purchase_date = values.purchase_date
  }

  const total = parseDecimalInput(values.total, 2)
  if (total === null) {
    errors.total = MONEY_ERROR
  } else if (Number(total) !== Number(receipt.total)) {
    changes.total = total
  }

  return { changes, errors }
}

export function saveErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Brak połączenia z serwerem. Sprawdź sieć i spróbuj ponownie.'
  }
  if (error.status === 422) {
    return 'Serwer odrzucił zmiany. Sprawdź wpisane wartości.'
  }
  if (error.status === 404) {
    return 'Tego już nie ma na paragonie. Odśwież stronę.'
  }
  return 'Nie udało się zapisać zmian. Spróbuj ponownie.'
}
