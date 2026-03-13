import React from 'react'

type AdminNavIconProps = Record<string, unknown>

export const AdminNavIcon: React.FC<AdminNavIconProps> = () => {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt="findmydoc icon"
      src="/fmd-icon-1-white.png"
      width={18}
      height={18}
      loading="eager"
      decoding="async"
      style={{
        display: 'block',
        width: '18px',
        height: '18px',
        objectFit: 'contain',
      }}
    />
  )
}

export default AdminNavIcon
