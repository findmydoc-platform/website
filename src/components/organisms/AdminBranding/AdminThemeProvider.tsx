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

    html[data-theme='light'] .btn--style-primary {
      --bg-color: var(--fmd-admin-accent-500);
      --hover-bg: var(--fmd-admin-accent-600);
      --hover-color: var(--theme-elevation-0);
    }

    html[data-theme='light'] .nav__link-indicator {
      background: var(--fmd-admin-accent-500);
    }

    html[data-theme='light'] .nav a.nav__link:hover .nav__link-label,
    html[data-theme='light'] .nav a.nav__link:focus-visible .nav__link-label {
      color: var(--fmd-admin-accent-600);
    }

    html[data-theme='light'] .collections__card-list .card--has-onclick:hover {
      border-color: var(--fmd-admin-accent-250);
      box-shadow: 0 6px 14px -10px rgba(15, 116, 216, 0.55);
    }

    html[data-theme='light'] .collections__card-list .card .btn--style-icon-label .btn__icon {
      border-color: var(--fmd-admin-accent-250);
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
      border-color: var(--fmd-admin-accent-500);
    }

    .fmd-admin-account-avatar:hover:not(.fmd-admin-account-avatar--active) {
      background: var(--theme-elevation-200);
      border-color: var(--fmd-admin-accent-600);
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
