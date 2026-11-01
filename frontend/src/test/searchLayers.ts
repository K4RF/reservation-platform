import { fireEvent, screen, within } from '@testing-library/react'

/** Exercise the actual staged editor, never hidden serialization controls. */
export function openDates(label = '숙박') {
  fireEvent.click(screen.getByRole('button', { name: `${label} 날짜 선택` }))
  return screen.getByRole('dialog', { name: '언제 머무르시나요?' })
}
export function directDates(label = '') {
  const dialog = openDates(label || '숙박')
  fireEvent.click(within(dialog).getByText('날짜 직접 입력', { selector: 'summary' }))
  return dialog
}
export function setStayDates(start: string, end: string, label = '') {
  const dialog = directDates(label)
  fireEvent.change(within(dialog).getByLabelText(`${label} 체크인`.trim()), {
    target: { value: start },
  })
  fireEvent.change(within(dialog).getByLabelText(`${label} 체크아웃`.trim()), {
    target: { value: end },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: '날짜 적용' }))
}
export function setGuests(value: string, label = '인원') {
  fireEvent.click(screen.getByRole('button', { name: `${label} 선택` }))
  const dialog = screen.getByRole('dialog', { name: '몇 명이 함께하시나요?' })
  fireEvent.change(within(dialog).getByRole('spinbutton', { name: label }), { target: { value } })
  fireEvent.click(within(dialog).getByRole('button', { name: '인원 적용' }))
}
export function committedDates(form: HTMLElement) {
  const data = new FormData(form as HTMLFormElement)
  return { checkInDate: data.get('checkInDate'), checkOutDate: data.get('checkOutDate') }
}

// Assertions may inspect serialization snapshots; edits always use visible editor controls.
export function committedDateInput(label: string) {
  const prefix = label.replace(/체크인|체크아웃/, '').trim()
  const trigger = screen.getByRole('button', { name: `${prefix || '숙박'} 날짜 선택` })
  return trigger
    .closest('.stay-date-range')!
    .querySelector<HTMLInputElement>(
      `input[name="${label.endsWith('체크인') ? 'checkInDate' : 'checkOutDate'}"]`,
    )!
}
export function committedGuestInput(label = '인원') {
  return screen
    .getByRole('button', { name: `${label} 선택` })
    .closest('.guest-count-picker')!
    .querySelector<HTMLInputElement>('input[name="guestCount"]')!
}
export function editStayDate(label: string, value: string) {
  const prefix = label.replace(/체크인|체크아웃/, '').trim()
  const dialog = screen.queryByRole('dialog', { name: '언제 머무르시나요?' }) ?? directDates(prefix)
  const summary = within(dialog).getByText('날짜 직접 입력', { selector: 'summary' })
  if (!summary.closest('details')!.open) fireEvent.click(summary)
  fireEvent.change(within(dialog).getByLabelText(label), { target: { value } })
  const apply = within(dialog).getByRole('button', { name: '날짜 적용' }) as HTMLButtonElement
  if (!apply.disabled) fireEvent.click(apply)
}
export function stepGuests(label = '인원', increment = true) {
  fireEvent.click(screen.getByRole('button', { name: `${label} 선택` }))
  fireEvent.click(
    screen.getByRole('button', { name: `${label} 1명 ${increment ? '늘리기' : '줄이기'}` }),
  )
  fireEvent.click(screen.getByRole('button', { name: '인원 적용' }))
}
