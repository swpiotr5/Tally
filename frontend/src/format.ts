// Display formatting only. Amounts arrive as decimal strings; turning them into numbers here is
// safe because they are only shown, never added up (two decimal places stay exact in a double).

const LOCALE = 'pl-PL'

const money = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'PLN' })
const decimal = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 3 })
const shortDate = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
const longDate = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' })
const dateTime = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' })
const pluralRules = new Intl.PluralRules(LOCALE)
const moneyInput = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
})
const quantityInput = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 3,
  useGrouping: false,
})

/** "23.40" -> "23,40 zł" */
export function formatMoney(amount: string): string {
  return money.format(Number(amount))
}

/**
 * Receipts print weighed goods with three decimals (0.742) and pieces as whole numbers,
 * so a fractional quantity is shown in kilograms and a whole one in pieces.
 */
export function formatQuantity(quantity: string): string {
  const value = Number(quantity)
  return Number.isInteger(value) ? `${value} szt.` : `${decimal.format(value)} kg`
}

/** "2026-10-17" -> "17 paź 2026". Parsed as a local date, so it never shifts by a day. */
export function formatDate(isoDate: string, style: 'short' | 'long' = 'short'): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return (style === 'long' ? longDate : shortDate).format(date)
}

/** ISO timestamp -> "17 paź 2026, 21:01" in the viewer's time zone. */
export function formatDateTime(isoDateTime: string): string {
  return dateTime.format(new Date(isoDateTime))
}

/** "3.5" -> "3,50": an amount the way a user types it, to prefill an input. */
export function toMoneyInput(amount: string): string {
  return moneyInput.format(Number(amount))
}

/** "2.000" -> "2", "0.535" -> "0,535" */
export function toQuantityInput(quantity: string): string {
  return quantityInput.format(Number(quantity))
}

/**
 * Read a number typed by the user ("3,49", "3.49", " 12 ") as the API's decimal string
 * ("3.49"). Returns null for anything else, including more decimal places than allowed.
 */
export function parseDecimalInput(text: string, maxPlaces: number): string | null {
  const normalized = text.trim().replace(',', '.')
  return new RegExp(`^\\d+(\\.\\d{1,${maxPlaces}})?$`).test(normalized) ? normalized : null
}

/** "1234563218" -> "123-456-32-18", the way a NIP is usually printed. */
export function formatNip(nip: string): string {
  return nip.replace(/^(\d{3})(\d{3})(\d{2})(\d{2})$/, '$1-$2-$3-$4')
}

interface PluralForms {
  one: string
  few: string
  many: string
}

/** Polish plurals: 1 pozycja, 2 pozycje, 5 pozycji, 22 pozycje. */
function pluralize(count: number, forms: PluralForms): string {
  const rule = pluralRules.select(count)
  const form = rule === 'one' ? forms.one : rule === 'few' ? forms.few : forms.many
  return `${count} ${form}`
}

export function formatItemCount(count: number): string {
  return pluralize(count, { one: 'pozycja', few: 'pozycje', many: 'pozycji' })
}

export function formatReceiptCount(count: number): string {
  return pluralize(count, { one: 'paragon', few: 'paragony', many: 'paragonów' })
}
