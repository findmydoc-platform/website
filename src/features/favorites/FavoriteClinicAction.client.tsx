'use client'

import type { UiCopyLocale } from '@/i18n/requestLocale'

import { getSavedClinicsTranslator } from './copy'
import { FavoriteClinicButton, type FavoriteClinicButtonProps } from './FavoriteClinicButton'

type FavoriteClinicActionProps = Pick<
  FavoriteClinicButtonProps,
  'clinicId' | 'initialFavoriteId' | 'isPatient' | 'loginHref' | 'variant' | 'favoriteApi' | 'onFavoriteChange'
> & {
  clinicName: string
  locale: UiCopyLocale
}

export function FavoriteClinicAction({ clinicName, locale, ...props }: FavoriteClinicActionProps) {
  const translate = getSavedClinicsTranslator(locale)
  const clinic = { clinic: clinicName }
  const inSavedList = props.variant === 'list'

  return (
    <FavoriteClinicButton
      {...props}
      lang={locale}
      savedLabel={translate(inSavedList ? 'remove' : 'saved')}
      unsavedLabel={translate('save')}
      pendingLabel={translate('saving')}
      removingLabel={translate('removing')}
      savedAriaLabel={translate('removeClinic', clinic)}
      unsavedAriaLabel={translate('saveClinic', clinic)}
      pendingAriaLabel={translate('savingClinic', clinic)}
      removingAriaLabel={translate('removingClinic', clinic)}
      reauthenticateLabel={translate('signInAgain')}
      feedback={{
        error: translate('updateError'),
        saved: translate('clinicSaved', clinic),
        removed: translate('clinicRemoved', clinic),
      }}
      showIcon={!inSavedList}
    />
  )
}
