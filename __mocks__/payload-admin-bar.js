import * as React from 'react'

export function PayloadAdminBar(props) {
  const { onAuthChange, logo } = props

  React.useEffect(() => {
    onAuthChange?.({ id: 'user-1', email: 'test@example.com' })
  }, [onAuthChange])

  return React.createElement(
    'div',
    { className: 'flex items-center gap-2' },
    React.createElement('div', null, logo),
    React.createElement(
      'button',
      {
        type: 'button',
        onClick: () => onAuthChange?.({ id: 'user-1', email: 'test@example.com' }),
      },
      'Log in',
    ),
    React.createElement(
      'button',
      {
        type: 'button',
        onClick: () => onAuthChange?.(null),
      },
      'Log out',
    ),
  )
}
