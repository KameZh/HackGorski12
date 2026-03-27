import { SignUp } from '@clerk/clerk-react'
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

export default function Signup() {
  return (
    <div className="auth-page">
      <div className="auth-glow auth-glow-top" />
      <div className="auth-glow auth-glow-bottom" />

      <div className="auth-shell">
        <section className="auth-hero">
          <span className="auth-badge">CREATE ACCOUNT</span>
          <h1 className="auth-title">Join Pytechka</h1>
          <p className="auth-subtitle">
            Create an account to record trails, personalize your map view, and
            keep all activity in one place.
          </p>
        </section>

        <section className="auth-panel">
          <SignUp
            routing="path"
            path="/signup"
            signInUrl="/login"
            appearance={clerkAppearance}
          />
        </section>
      </div>
    </div>
  )
}
