import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { ApiError, missingReceiptFields, uploadReceipt } from '../api'
import { BackLink } from '../components/BackLink'
import { Banner } from '../components/Banner'
import {
  CameraIcon,
  CloseIcon,
  ImageIcon,
  PaperIcon,
  PlusIcon,
  ScanIcon,
  SunIcon,
} from '../components/icons'
import styles from './UploadPage.module.css'

// A long receipt is photographed in parts; the API takes at most this many photos.
const MAX_PHOTOS = 5

interface Photo {
  // A counter, not crypto.randomUUID(): that needs HTTPS, and the phone uses plain HTTP on the LAN.
  id: number
  file: File
}

export function UploadPage() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const nextId = useRef(0)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  function openPicker() {
    inputRef.current?.click()
  }

  function addPhotos(files: Iterable<File>) {
    const chosen = Array.from(files)
    // The picker only offers images; dropped files can be anything.
    const images = chosen.filter((file) => file.type.startsWith('image/'))
    const room = MAX_PHOTOS - photos.length
    if (images.length < chosen.length) {
      setError('To nie jest zdjęcie. Wybierz plik JPEG, PNG, WebP lub HEIC.')
    } else if (images.length > room) {
      setError(`Jeden paragon może mieć najwyżej ${MAX_PHOTOS} zdjęć.`)
    } else {
      setError(null)
    }
    const added = images.slice(0, room).map((file) => ({ id: nextId.current++, file }))
    setPhotos((current) => [...current, ...added])
  }

  function removePhoto(id: number) {
    setPhotos((current) => current.filter((photo) => photo.id !== id))
    setError(null)
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setDragging(false)
    addPhotos(event.dataTransfer.files)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (photos.length === 0) {
      return
    }
    setUploading(true)
    setError(null)
    try {
      const receipt = await uploadReceipt(photos.map((photo) => photo.file))
      // Replace the upload page in history, so "back" from the result goes to the list.
      await navigate(`/receipts/${receipt.id}`, { replace: true, state: { justUploaded: true } })
    } catch (err) {
      // The photos stay, so the user can add the missing part and send them again.
      setError(uploadErrorMessage(err))
      setUploading(false)
    }
  }

  return (
    <>
      <title>Nowy paragon · Tally</title>
      <BackLink to="/">Paragony</BackLink>
      <h1 className={styles.title}>Nowy paragon</h1>
      <p className={styles.lead}>
        Zrób zdjęcie paragonu albo wybierz je z galerii. Tally odczyta sklep, datę i wszystkie
        pozycje.
      </p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          aria-label="Zdjęcia paragonu"
          className="visually-hidden"
          tabIndex={-1}
          onChange={(event) => {
            addPhotos(event.target.files ?? [])
            // Allow picking the same file again.
            event.target.value = ''
          }}
        />

        {photos.length > 0 ? (
          <>
            <div className={styles.photos} data-count={photos.length} data-scanning={uploading}>
              {photos.map((photo, index) => (
                <figure key={photo.id} className={styles.photo}>
                  <PhotoPreview file={photo.file} label={`Zdjęcie ${index + 1} paragonu`} />
                  {photos.length > 1 && (
                    <span className={styles.photoNumber} aria-hidden="true">
                      {index + 1}
                    </span>
                  )}
                  <button
                    type="button"
                    className={styles.removePhoto}
                    aria-label={`Usuń zdjęcie ${index + 1}`}
                    disabled={uploading}
                    onClick={() => removePhoto(photo.id)}
                  >
                    <CloseIcon />
                  </button>
                </figure>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  className={styles.addPhoto}
                  disabled={uploading}
                  onClick={openPicker}
                >
                  <PlusIcon />
                  Dodaj dalszą część paragonu
                </button>
              )}
            </div>
            {photos.length === 1 && !uploading && (
              <p className={styles.hint}>
                Długi paragon? Zrób kolejne zdjęcia od góry do dołu, tak żeby zachodziły na siebie
                o kilka linii.
              </p>
            )}
            {error && <Banner tone="danger">{error}</Banner>}
            <button
              type="submit"
              className="button button-primary button-block"
              disabled={uploading}
              aria-busy={uploading}
            >
              {uploading ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Odczytuję paragon…
                </>
              ) : (
                <>
                  <ScanIcon />
                  Odczytaj paragon
                </>
              )}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={styles.dropzone}
              data-dragging={dragging}
              onClick={openPicker}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <span className={styles.dropIcon}>
                <CameraIcon />
              </span>
              <span className={styles.dropTitle}>Zrób zdjęcie</span>
              <span className={styles.dropHint}>lub wybierz z galerii</span>
            </button>
            {error && <Banner tone="danger">{error}</Banner>}
            <ul className={styles.tips} aria-label="Wskazówki">
              <li>
                <ScanIcon />
                Cały paragon w kadrze, od nagłówka do sumy
              </li>
              <li>
                <SunIcon />
                Dobre światło, bez cieni i odblasków
              </li>
              <li>
                <PaperIcon />
                Paragon płasko, bez zagięć
              </li>
            </ul>
          </>
        )}

        <p className="visually-hidden" aria-live="polite">
          {uploading ? 'Odczytuję paragon…' : ''}
        </p>
      </form>
    </>
  )
}

function PhotoPreview({ file, label }: { file: File; label: string }) {
  const imageRef = useRef<HTMLImageElement>(null)
  const [failed, setFailed] = useState(false)

  // An object URL holds the file in memory until revoked, so tie its lifetime to this file.
  useEffect(() => {
    const url = URL.createObjectURL(file)
    if (imageRef.current) {
      imageRef.current.src = url
    }
    return () => URL.revokeObjectURL(url)
  }, [file])

  if (failed) {
    // E.g. HEIC outside Safari: the browser cannot show it, but the upload still works.
    return (
      <div className={styles.previewFallback} role="img" aria-label={label}>
        <ImageIcon />
        <span className={styles.fileName}>{file.name}</span>
        <span>Podgląd niedostępny, ale zdjęcie można wysłać.</span>
      </div>
    )
  }
  return <img ref={imageRef} alt={label} onError={() => setFailed(true)} />
}

function uploadErrorMessage(error: unknown): string {
  const missing = missingReceiptFields(error)
  if (missing) {
    const what =
      missing.length > 1 ? 'daty ani sumy' : missing[0] === 'total' ? 'sumy' : 'daty'
    return `Na zdjęciach nie widać ${what} paragonu. Dodaj zdjęcie dołu paragonu i spróbuj ponownie.`
  }
  if (!(error instanceof ApiError)) {
    return 'Brak połączenia z serwerem. Sprawdź sieć i spróbuj ponownie.'
  }
  if (error.status === 415) {
    return 'Ten format pliku nie jest obsługiwany. Wybierz zdjęcie JPEG, PNG, WebP lub HEIC.'
  }
  if (error.status === 413) {
    return 'Zdjęcie jest za duże. Spróbuj zrobić je jeszcze raz.'
  }
  if (error.status === 502) {
    // The backend could not read the receipt: usually a blurry or cropped photo.
    return 'Nie udało się odczytać paragonu. Zrób wyraźne zdjęcie całego paragonu i spróbuj ponownie.'
  }
  return 'Nie udało się odczytać paragonu. Spróbuj ponownie.'
}
