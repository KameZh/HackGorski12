import { SignIn } from '@clerk/clerk-react'
import './Auth.css'

export default function Login() {
  return (
    <div className="auth-container">
      <SignIn routing="path" path="/login" signUpUrl="/signup" />
    </div>
  )
}
