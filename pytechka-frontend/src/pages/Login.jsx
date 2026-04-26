import { SignIn, useSignIn } from '@clerk/clerk-react'
import { Capacitor } from '@capacitor/core'
import './Auth.css'

const clerkAppearance = {
  elements: {
    card: 'auth-clerk-root',
    headerTitle: 'auth-clerk-header-title',
    headerSubtitle: 'auth-clerk-header-subtitle',
    socialButtonsBlockButton: 'auth-clerk-social-btn',
    socialButtonsBlockButtonText: 'auth-clerk-social-btn-text',
    formButtonPrimary: 'auth-clerk-primary-btn',
    formFieldInput: 'auth-clerk-input',
    formFieldLabel: 'auth-clerk-label',
    footerActionLink: 'auth-clerk-link',
    dividerLine: 'auth-clerk-divider-line',
    dividerText: 'auth-clerk-divider-text',
    formFieldAction: 'auth-clerk-link',
  },
}

const AUTH_REDIRECT_URL = '/'

export default function Login() {
  const { isLoaded, signIn } = useSignIn()

  const handleGoogleSignIn = async () => {
    if (!isLoaded || !signIn) return

    const origin = window.location.origin

    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: `${origin}/sso-callback`,
        redirectUrlComplete: `${origin}/`,
      })
    } catch (error) {
      console.error('Google sign-in redirect failed:', error)
    }
  }

  const showNativeGoogleShortcut = Capacitor.isNativePlatform()

  return (
    <div className="auth-page">
      <div className="auth-glow auth-glow-top" />
      <div className="auth-glow auth-glow-bottom" />

      <div className="auth-shell">
        <section className="auth-hero">
          <div className="auth-title-inline">
            <h1 className="auth-title">Welcome Back</h1>
            <span className="auth-badge">PYTECHKA ACCESS</span>
          </div>
          <p className="auth-subtitle">
            Log in to continue tracking routes, reviewing map layers, and saving
            your progress.
          </p>
        </section>

        <section className="auth-panel">
          {showNativeGoogleShortcut ? (
            <button
              type="button"
              className="auth-google-direct-btn"
              onClick={handleGoogleSignIn}
              disabled={!isLoaded}
            >
              Continue with Google
            </button>
          ) : null}

          <SignIn
            routing="path"
            path="/login"
            signUpUrl="/signup"
            oauthFlow="redirect"
            fallbackRedirectUrl={AUTH_REDIRECT_URL}
            forceRedirectUrl={AUTH_REDIRECT_URL}
            signUpFallbackRedirectUrl="/signup"
            signUpForceRedirectUrl="/signup"
            appearance={clerkAppearance}
          />
        </section>
      </div>
    </div>
  )
}
