"use client"

import type React from "react"
import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { LegalDocumentModal } from "@/components/legal/LegalDocumentModal"
import { TermsOfServiceContent } from "@/app/legal/terms-of-service/page"
import { PrivacyPolicyContent } from "@/app/legal/privacy-policy/page"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"
import type { AuthError } from '@supabase/supabase-js'
import { appLogger, statusLogger } from '@/lib/logger'

/**
 * Sign-up Page component.
 *
 * This component acts as the entry point for the sign-up route.
 * It wraps the main `SignupContent` component in a React Suspense
 * boundary to correctly handle client-side hooks like `useSearchParams`.
 *
 * @returns {JSX.Element} The Sign-up Page UI wrapped in Suspense.
 */
export default function SignupPage() {
  // The main export wraps SignupContent in Suspense
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading Page...</div>}>
      <SignupContent />
    </Suspense>
  )
}

/**
 * Renders the sign-up form and manages the sign-up process.
 *
 * This client component handles user input for email and password,
 * performs client-side validation (password match, length),
 * interacts with the `useAuth` hook to call the `signUp` function,
 * displays loading states and feedback messages (success/error) using toasts,
 * handles redirection based on authentication state or server feedback
 * (e.g., after email confirmation request), and prevents access if the user
 * is already logged in.
 *
 * @returns {JSX.Element} The Sign-up form UI or a loading spinner.
 */
// --- Define the inner component containing the client logic ---
function SignupContent() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [termsConsent, setTermsConsent] = useState(false)
  const [ageConsent, setAgeConsent] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const { signUp, user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!authLoading && user) {
      router.push("/")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const message = searchParams.get('message')
    const error = searchParams.get('error')
    if (message === 'confirmation_email_sent') {
      toast.success("Confirmation Email Sent", {
        description: "Please check your email to confirm your account."
      })
    }
    if (error) {
      toast.error("Signup Error", { description: error })
    }
    if (message || error) {
      router.replace('/signup', { scroll: false })
    }
  }, [searchParams, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password || !confirmPassword) {
      toast.error("Missing Information", {
        description: "Please fill in all fields."
      })
      return
    }

    if (!termsConsent || !ageConsent) {
      toast.error("Legal Consent Required", {
        description: "Please agree to the Terms of Service and confirm your age to continue."
      })
      return
    }

    if (password !== confirmPassword) {
      toast.error("Password Mismatch", {
        description: "The passwords entered do not match."
      })
      return
    }

    if (password.length < 6) {
      toast.error("Password Too Short", {
        description: "Password must be at least 6 characters long."
      })
      return
    }

    setIsLoading(true)

    try {
      const { data, error } = await signUp(email, password)

      if (error) {
        appLogger.error("Sign up error:", error)
        if (error instanceof Error) {
          toast.error(error.message || "An unexpected error occurred during sign up.")
        } else {
          toast.error((error as any).message || "Sign up failed. Please try again.")
        }
      } else if (data?.user) {
        if (data?.session) {
          // User has a session (email confirmation disabled), redirect immediately
          toast.success("Sign up successful! Redirecting...")
          // Add a small delay to ensure auth state has propagated
          setTimeout(() => {
            router.push("/")
          }, 100)
        } else {
          // No session means email confirmation is required
          toast.info("Sign up successful! Please check your email to confirm your account.")
          router.push("/login?message=check_email")
        }
      } else {
        toast.error("An unexpected issue occurred during sign up. Please try again.")
      }
    } catch (err) {
      appLogger.error("Signup submit error:", err)
      toast.error("Sign Up Failed", {
        description: "An unexpected error occurred. Please try again later."
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading || user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Create an account</CardTitle>
          <CardDescription className="text-center">Enter your email and password to sign up</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <Separator />

            {/* Legal Consent Section */}
            <div className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Legal Requirements</h4>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="terms-consent-signup"
                      checked={termsConsent}
                      onCheckedChange={(checked) => setTermsConsent(checked as boolean)}
                      disabled={isLoading}
                    />
                    <div className="space-y-1">
                      <Label 
                        htmlFor="terms-consent-signup" 
                        className="text-sm leading-5 cursor-pointer"
                      >
                        I agree to the{" "}
                        <button
                          type="button"
                          onClick={() => setShowTermsModal(true)}
                          className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                          disabled={isLoading}
                        >
                          Terms of Service
                        </button>
                        {" "}and{" "}
                        <button
                          type="button"
                          onClick={() => setShowPrivacyModal(true)}
                          className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                          disabled={isLoading}
                        >
                          Privacy Policy
                        </button>.
                      </Label>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="age-consent-signup"
                      checked={ageConsent}
                      onCheckedChange={(checked) => setAgeConsent(checked as boolean)}
                      disabled={isLoading}
                    />
                    <div className="space-y-1">
                      <Label 
                        htmlFor="age-consent-signup" 
                        className="text-sm leading-5 cursor-pointer"
                      >
                        I confirm that I am at least 16 years old. If this account will be used by a child under 16, I am the parent or legal guardian and I give consent on their behalf.
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || !termsConsent || !ageConsent}
            >
              {isLoading ? "Creating account..." : "Sign up"}
            </Button>
          </CardFooter>
        </form>
        <CardFooter className="flex flex-col items-center justify-center space-y-2">
          <div className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>

      {/* Legal Document Modals */}
      <LegalDocumentModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        title="Terms of Service"
      >
        <TermsOfServiceContent />
      </LegalDocumentModal>

      <LegalDocumentModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        title="Privacy Policy"
      >
        <PrivacyPolicyContent />
      </LegalDocumentModal>
    </div>
  )
}
// --- End of SignupContent component ---

