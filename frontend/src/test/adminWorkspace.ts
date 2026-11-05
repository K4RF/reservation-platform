import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect } from 'vitest'

export async function openAdminPanel(label: string) {
  const control = await waitFor(() => {
    const button = within(screen.getByRole('group', { name: '레코드 작업' })).getByRole('button', {
      name: label,
    })
    expect(button).toHaveProperty('disabled', false)
    return button
  })
  if (control.getAttribute('aria-pressed') !== 'true') fireEvent.click(control)
  return screen.getByRole('region', { name: `${label} 패널` })
}
