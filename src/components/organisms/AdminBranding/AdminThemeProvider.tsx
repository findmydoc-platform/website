import React from 'react'

type AdminThemeProviderProps = {
  children?: React.ReactNode
}

const adminThemeCSS = `
  @layer payload-default {
    :root {
      --fmd-admin-accent-100: #edf4ff;
      --fmd-admin-accent-250: #c7dbff;
      --fmd-admin-accent-500: #0f74d8;
      --fmd-admin-accent-600: #0d67bf;
    }

    html[data-theme='light'] {
      --theme-success-100: var(--fmd-admin-accent-100);
      --theme-success-250: var(--fmd-admin-accent-250);
      --theme-success-500: var(--fmd-admin-accent-500);
      --theme-success-600: var(--fmd-admin-accent-600);
    }

    .fmd-admin-account-avatar {
      width: 25px;
      height: 25px;
      display: block;
      border-radius: 999px;
      object-fit: cover;
      background: var(--theme-elevation-50);
      border: 1px solid var(--theme-elevation-200);
    }

    .fmd-admin-account-avatar--active {
      border-color: var(--theme-elevation-600);
    }

    .fmd-admin-account-avatar:hover:not(.fmd-admin-account-avatar--active) {
      background: var(--theme-elevation-200);
      border-color: var(--theme-elevation-600);
    }
  }
`

export const AdminThemeProvider: React.FC<AdminThemeProviderProps> = ({ children }) => {
  return (
    <>
      <style data-fmd-admin-theme="true">{adminThemeCSS}</style>
      {children}
    </>
  )
}

export default AdminThemeProvider
