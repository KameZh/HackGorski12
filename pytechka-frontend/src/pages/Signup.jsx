import { SignUp } from '@clerk/clerk-react'
import './Auth.css'

export default function Signup() {
  return (
    <div className="auth-container">
      <SignUp routing="path" path="/signup" signInUrl="/login" />
    </div>
  )
}
