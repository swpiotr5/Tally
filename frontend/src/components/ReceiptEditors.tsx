import { useState, type FormEvent } from 'react'

import {
  deleteReceiptItem,
  updateReceipt,
  updateReceiptItem,
  type Receipt,
  type ReceiptItem,
} from '../api'
import {
  itemChanges,
  itemFormValues,
  receiptChanges,
  receiptFormValues,
  saveErrorMessage,
  type FormErrors,
  type ItemFormValues,
  type ReceiptFormValues,
} from '../receiptForms'
import { Banner } from './Banner'
import { CategoryPicker } from './CategoryPicker'
import styles from './ReceiptEditors.module.css'
import { TrashIcon } from './icons'
import { Sheet } from './Sheet'
import { TextField } from './TextField'

interface EditorProps {
  onClose: () => void
  /** Called after a successful change; resolves once the page shows the new data. */
  onSaved: () => Promise<void>
}

/** Runs a save request, then onSaved; keeps the form open with a message if it fails. */
function useSave(onSaved: () => Promise<void>) {
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  async function run(request: () => Promise<unknown>) {
    setBusy(true)
    setFailure(null)
    try {
      await request()
      await onSaved()
    } catch (error) {
      setFailure(saveErrorMessage(error))
      setBusy(false)
    }
  }

  return { busy, failure, run }
}

function SaveButtons({ busy, onCancel }: { busy: boolean; onCancel: () => void }) {
  return (
    <>
      <button
        type="submit"
        className="button button-primary button-block"
        disabled={busy}
        aria-busy={busy}
      >
        {busy && <span className="spinner" aria-hidden="true" />}
        {busy ? 'Zapisuję…' : 'Zapisz'}
      </button>
      <button
        type="button"
        className="button button-secondary button-block"
        disabled={busy}
        onClick={onCancel}
      >
        Anuluj
      </button>
    </>
  )
}

export function ItemEditor({
  receiptId,
  item,
  onClose,
  onSaved,
}: EditorProps & { receiptId: number; item: ReceiptItem }) {
  const [values, setValues] = useState(() => itemFormValues(item))
  const [errors, setErrors] = useState<FormErrors<ItemFormValues>>({})
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const { busy, failure, run } = useSave(onSaved)

  function field(name: Exclude<keyof ItemFormValues, 'category'>) {
    return {
      value: values[name],
      onChange: (value: string) => setValues((current) => ({ ...current, [name]: value })),
      error: errors[name],
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const { changes, errors } = itemChanges(item, values)
    setErrors(errors)
    if (Object.keys(errors).length > 0) {
      return
    }
    if (Object.keys(changes).length === 0) {
      onClose()
      return
    }
    void run(() => updateReceiptItem(receiptId, item.id, changes))
  }

  function remove() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    void run(() => deleteReceiptItem(receiptId, item.id))
  }

  return (
    <Sheet title="Popraw pozycję" onClose={onClose}>
      <form className={styles.form} onSubmit={save} noValidate>
        <TextField label="Nazwa z paragonu" autoComplete="off" {...field('raw_name')} />
        <CategoryPicker
          value={values.category}
          onChange={(category) => setValues((current) => ({ ...current, category }))}
        />
        <div className={styles.grid}>
          <TextField label="Ilość" inputMode="decimal" {...field('quantity')} />
          <TextField label="Cena jedn. (zł)" inputMode="decimal" {...field('unit_price')} />
          <TextField label="Wartość (zł)" inputMode="decimal" {...field('total_price')} />
          <TextField label="Rabat (zł)" inputMode="decimal" {...field('discount')} />
        </div>
        {failure && <Banner tone="danger">{failure}</Banner>}
        <div className={styles.actions}>
          <SaveButtons busy={busy} onCancel={onClose} />
          <button type="button" className={styles.delete} disabled={busy} onClick={remove}>
            <TrashIcon />
            {confirmingDelete ? 'Potwierdź usunięcie' : 'Usuń pozycję'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}

export function ReceiptHeaderEditor({
  receipt,
  onClose,
  onSaved,
}: EditorProps & { receipt: Receipt }) {
  const [values, setValues] = useState(() => receiptFormValues(receipt))
  const [errors, setErrors] = useState<FormErrors<ReceiptFormValues>>({})
  const { busy, failure, run } = useSave(onSaved)

  function field(name: keyof ReceiptFormValues) {
    return {
      value: values[name],
      onChange: (value: string) => setValues((current) => ({ ...current, [name]: value })),
      error: errors[name],
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const { changes, errors } = receiptChanges(receipt, values)
    setErrors(errors)
    if (Object.keys(errors).length > 0) {
      return
    }
    if (Object.keys(changes).length === 0) {
      onClose()
      return
    }
    void run(() => updateReceipt(receipt.id, changes))
  }

  return (
    <Sheet title="Popraw dane paragonu" onClose={onClose}>
      <form className={styles.form} onSubmit={save} noValidate>
        <TextField label="Sklep" autoComplete="off" {...field('store_name')} />
        <div className={styles.grid}>
          <TextField label="Data zakupu" type="date" {...field('purchase_date')} />
          <TextField label="Suma (zł)" inputMode="decimal" {...field('total')} />
        </div>
        <TextField
          label="NIP (opcjonalnie)"
          inputMode="numeric"
          autoComplete="off"
          {...field('store_nip')}
        />
        {failure && <Banner tone="danger">{failure}</Banner>}
        <div className={styles.actions}>
          <SaveButtons busy={busy} onCancel={onClose} />
        </div>
      </form>
    </Sheet>
  )
}
