import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { exchangeGoogleLoginCode } from '../api/auth'
import { consumeGoogleCallback } from '../api/googleOAuth2'
import { routePaths } from '../app/routePaths'
import { LoadingState } from '../components/ui/LoadingState'
import { useAuth } from '../state/useAuth'
import { authReturnDestination, consumeGoogleReturn } from '../app/loginReturn'
import { AuthExploreLink, AuthPageLayout } from '../components/ui/AuthPageLayout'

type CallbackStatus = 'working' | 'cancelled' | 'failed' | 'invalid' | 'exchange_failed'

export function OAuth2CallbackPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const started = useRef(false)
  const active = useRef(false)
  const [returnTarget, setReturnTarget] = useState<string>(routePaths.home)
  const [status, setStatus] = useState<CallbackStatus>('working')

  useEffect(() => {
    active.current = true
    if (!started.current) {
      started.current = true
      const callback = consumeGoogleCallback(location.hash)
      const returnPath = consumeGoogleReturn()
      queueMicrotask(() => {
        if (active.current) setReturnTarget(returnPath)
      })
      window.history.replaceState(window.history.state, '', location.pathname + location.search)
      if (callback.type !== 'code') {
        queueMicrotask(() => {
          if (active.current) setStatus(callback.type)
        })
      } else {
        void exchangeGoogleLoginCode(callback.code)
          .then((tokens) => {
            if (!active.current) return
            signIn(tokens.accessToken, tokens.refreshToken)
            navigate(returnPath, { replace: true })
          })
          .catch(() => {
            if (active.current) setStatus('exchange_failed')
          })
      }
    }
    return () => {
      active.current = false
    }
  }, [location.hash, location.pathname, location.search, navigate, signIn])

  const message = {
    cancelled: 'Google 로그인이 취소되었습니다.',
    failed: 'Google 인증에 실패했습니다. 다시 시도해 주세요.',
    invalid: '로그인 요청을 확인할 수 없습니다. 다시 시작해 주세요.',
    exchange_failed: 'Google 로그인을 완료하지 못했습니다. 다시 시도해 주세요.',
  } as const

  return (
    <AuthPageLayout
      headingId="oauth-title"
      eyebrow="SIGN IN WITH GOOGLE"
      title="Google 로그인"
      variant="notice"
      description={
        status === 'working'
          ? '인증 결과를 확인하고 있습니다.'
          : '이메일이나 Google로 다시 로그인할 수 있습니다.'
      }
    >
      {status === 'working' ? (
        <LoadingState message="Google 로그인을 완료하고 있습니다." />
      ) : (
        <>
          <p role="alert">{message[status]}</p>
          <div className="auth-actions">
            <Link
              className="auth-return-link primary-action"
              to={routePaths.login}
              state={{ from: returnTarget }}
            >
              로그인으로 돌아가기
            </Link>
            <AuthExploreLink to={authReturnDestination(returnTarget).explore} />
          </div>
        </>
      )}
    </AuthPageLayout>
  )
}
