'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast, Upload, useConfig, useDocumentInfo, useField } from '@payloadcms/ui'

import { getMediaUploadHint, getMediaUploadValidationError } from '@/config/mediaUploadPolicy'

import './index.scss'

const baseClass = 'policy-aware-upload'

export default function PolicyAwareUpload() {
  const { collectionSlug, initialState, setUploadStatus } = useDocumentInfo()
  const { getEntityConfig } = useConfig()
  const { setValue } = useField<File | undefined>({ path: 'file' })
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [uploadKey, setUploadKey] = useState(0)
  const uploadContainerRef = useRef<HTMLDivElement>(null)
  const shouldRestoreFocusRef = useRef(false)

  const collectionConfig = collectionSlug ? getEntityConfig({ collectionSlug }) : null
  const uploadConfig = collectionConfig?.upload
  const acceptedMimeTypes = useMemo(() => uploadConfig?.mimeTypes ?? [], [uploadConfig?.mimeTypes])
  const hint = useMemo(() => getMediaUploadHint(acceptedMimeTypes), [acceptedMimeTypes])

  useEffect(() => {
    if (!shouldRestoreFocusRef.current) return

    shouldRestoreFocusRef.current = false
    uploadContainerRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [uploadKey])

  const handleChange = useCallback(
    (file?: File) => {
      if (!file) {
        setErrorMessage(null)
        return
      }

      const validationError = getMediaUploadValidationError({
        acceptedMimeTypes,
        mimeType: file.type,
        size: file.size,
      })

      if (!validationError) {
        setErrorMessage(null)
        return
      }

      setValue(undefined)
      setUploadStatus?.('idle')
      setErrorMessage(validationError)
      shouldRestoreFocusRef.current = true
      setUploadKey((currentKey) => currentKey + 1)
      toast.error(validationError)
    },
    [acceptedMimeTypes, setUploadStatus, setValue],
  )

  if (!collectionSlug || !uploadConfig) return null

  return (
    <div className={baseClass}>
      <div key={uploadKey} ref={uploadContainerRef}>
        <Upload
          collectionSlug={collectionSlug}
          initialState={initialState}
          onChange={handleChange}
          uploadConfig={uploadConfig}
        />
      </div>
      <p className={`${baseClass}__hint`}>{hint}</p>
      {errorMessage ? (
        <p aria-live="assertive" className={`${baseClass}__error`} role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
