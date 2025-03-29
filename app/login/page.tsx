"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"
import type { AuthError } from '@supabase/supabase-js'

/**
 * Renders the login page component.
 * Allows users to sign in using their email and password.
 * Displays feedback messages from auth callbacks (e.g., email confirmation).
 * Redirects authenticated users to the home page.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signIn, user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const message = searchParams.get('message')
    const error = searchParams.get('error')

    if (message === 'email_already_confirmed_or_link_invalid') {
      toast("Your email may already be confirmed, or the link was invalid/expired. Please try logging in.")
    } else if (error === 'confirmation_failed') {
      toast.error("Email Confirmation Failed", {
        description: "Could not confirm your email. Please try the link again or sign up if needed."
      })
    } else if (error === 'missing_confirmation_code') {
      toast.error("Invalid Link", {
        description: "The confirmation link is missing necessary information. Please use the link from your email."
      })
    }

    if (message || error) {
      router.replace('/login', { scroll: false })
    }
  }, [searchParams, router])

  useEffect(() => {
    if (!authLoading && user) {
      router.push("/")
    }
  }, [user, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (!email || !password) {
      toast.error("Missing Information", {
        description: "Please enter both email and password."
      })
      setIsSubmitting(false)
      return
    }

    try {
      const { error } = await signIn(email, password)

      if (error) {
        console.error("Sign in error:", error)
        if (error instanceof Error) {
          toast.error(error.message || "An unexpected error occurred during sign in.")
        } else {
          toast.error(error.message || "Invalid login credentials.")
        }
      } else {
        toast.success("Sign in successful! Redirecting...")
        router.push("/")
      }
    } catch (error) {
      console.error("Login submit error:", error)
      toast.error("Login Failed", {
        description: "An unexpected error occurred. Please try again later."
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading || user) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">StudyCards</CardTitle>
          <CardDescription className="text-center">Enter your email and password to sign in</CardDescription>
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
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/auth/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </CardFooter>
        </form>
        <CardFooter className="flex flex-col items-center justify-center space-y-2">
          <div className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

