import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { ApiError, uploadReceipt } from '../api'
import { BackLink } from '../components/BackLink'
import { Banner } from '../components/Banner'
import { CameraIcon, ImageIcon, PaperIcon, ScanIcon, SunIcon } from '../components/icons'
import styles from './UploadPage.module.css'

export function UploadPage() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [image, setImage] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  function openPicker() {
    inputRef.current?.click()
  }

  function choose(file: File | undefined) {
    if (!file) {
      return
    }
    // The picker only offers images; dropped files can be anything.
    if (!file.type.startsWith('image/')) {
      setError('To nie jest zdjęcie. Wybierz plik JPEG, PNG, WebP lub HEIC.')
      return
    }
    setError(null)
    setImage(file)
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setDragging(false)
    choose(event.dataTransfer.files[0])
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!image) {
      return
    }
    setUploading(true)
    setError(null)
    try {
      const receipt = await uploadReceipt(image)
      // Replace the upload page in history, so "back" from the result goes to the list.
      await navigate(`/receipts/${receipt.id}`, { replace: true, state: { justUploaded: true } })
    } catch (err) {
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
          aria-label="Zdjęcie paragonu"
          className="visually-hidden"
          tabIndex={-1}
          onChange={(event) => {
            choose(event.target.files?.[0])
            // Allow picking the same file again after "change photo".
            event.target.value = ''
          }}
        />

        {image ? (
          <>
            <div className={styles.preview} data-scanning={uploading}>
              <ImagePreview key={`${image.name}-${image.size}-${image.lastModified}`} file={image} />
            </div>
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
            <button
              type="button"
              className="button button-secondary button-block"
              disabled={uploading}
              onClick={openPicker}
            >
              Zmień zdjęcie
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

function ImagePreview({ file }: { file: File }) {
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
      <div className={styles.previewFallback}>
        <ImageIcon />
        <span className={styles.fileName}>{file.name}</span>
        <span>Podgląd niedostępny, ale zdjęcie można wysłać.</span>
      </div>
    )
  }
  return <img ref={imageRef} alt="Podgląd zdjęcia paragonu" onError={() => setFailed(true)} />
}

function uploadErrorMessage(error: unknown): string {
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
