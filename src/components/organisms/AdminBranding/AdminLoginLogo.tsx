import React from 'react'

type AdminLoginLogoProps = Record<string, unknown>

export const AdminLoginLogo: React.FC<AdminLoginLogoProps> = () => {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt="findmydoc icon"
      src="/fmd-icon-1-white.png"
      width={56}
      height={56}
      loading="eager"
      decoding="async"
      style={{
        display: 'block',
        width: '56px',
        height: '56px',
        objectFit: 'contain',
        borderRadius: '14px',
        backgroundColor: 'var(--fmd-admin-accent-500)',
        padding: '10px',
        boxSizing: 'border-box',
      }}
    />
  )
}

export default AdminLoginLogo
