import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from '../app/routes'
import { signUpMember } from '../api/member'
import { ApiError } from '../api/errors'
import { AuthProvider } from '../state/AuthProvider'

vi.mock('../api/member', () => ({ signUpMember: vi.fn() }))

beforeEach(() => vi.resetAllMocks())

function renderSignup() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/signup']}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  )
}

function enterValidDetails() {
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: ' Member@Example.com ' } })
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'Password123!' } })
}

describe('signup flow', () => {
  it('renders the signup route and blocks invalid local input', () => {
    renderSignup()
    expect(screen.getByRole('heading', { name: '회원가입' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '회원가입' }))
    expect(screen.getByText('이메일을 입력해 주세요.')).toBeTruthy()
    expect(screen.getByText('비밀번호를 입력해 주세요.')).toBeTruthy()
    expect(signUpMember).not.toHaveBeenCalled()
  })

  it('submits once while pending, then navigates home with confirmation', async () => {
    let complete!: (value: { memberId: number; email: string; role: 'USER' }) => void
    vi.mocked(signUpMember).mockReturnValue(
      new Promise((resolve) => {
        complete = resolve
      }),
    )
    const { container } = renderSignup()
    enterValidDetails()

    const form = container.querySelector('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(signUpMember).toHaveBeenCalledOnce()
    expect(signUpMember).toHaveBeenCalledWith({
      email: 'Member@Example.com',
      password: 'Password123!',
    })
    expect(screen.getByRole('button', { name: '회원가입' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('status').textContent).toContain('처리하고 있습니다')

    complete({ memberId: 7, email: 'member@example.com', role: 'USER' })
    expect(await screen.findByRole('heading', { name: 'Reservation Platform' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('회원가입이 완료되었습니다')
  })

  it('maps backend field validation errors to the matching input', async () => {
    vi.mocked(signUpMember).mockRejectedValue(
      new ApiError('입력값이 올바르지 않습니다.', {
        kind: 'http',
        status: 400,
        category: 'bad_request',
        code: 'COMMON_001',
        fieldErrors: [{ field: 'email', message: '이메일 형식이 올바르지 않습니다.' }],
      }),
    )
    renderSignup()
    enterValidDetails()
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }))

    expect(await screen.findByText('이메일 형식이 올바르지 않습니다.')).toBeTruthy()
    expect(screen.getByLabelText('이메일').getAttribute('aria-invalid')).toBe('true')
  })

  it('shows duplicate email as an email field error', async () => {
    vi.mocked(signUpMember).mockRejectedValue(
      new ApiError('이미 가입된 이메일입니다.', {
        kind: 'http',
        status: 409,
        category: 'conflict',
        code: 'MEMBER_001',
      }),
    )
    renderSignup()
    enterValidDetails()
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }))

    expect(await screen.findByText('이미 가입된 이메일입니다.')).toBeTruthy()
  })

  it('shows a retryable message for network failure', async () => {
    vi.mocked(signUpMember).mockRejectedValue(
      new ApiError('Network request failed', { kind: 'network' }),
    )
    renderSignup()
    enterValidDetails()
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('서버에 연결하지 못했습니다')
    })
  })
})
