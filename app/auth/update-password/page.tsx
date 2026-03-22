"use client"

import type React from "react"
import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSupabase } from "@/hooks/use-supabase"
import { toast } from "sonner"
import { Loader2 as IconLoader } from "lucide-react"

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <UpdatePasswordContent />
    </Suspense>
  )
}

function UpdatePasswordContent() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isExchanging, setIsExchanging] = useState(true)
  const [sessionReady, setSessionReady] = useState(false)
  const { supabase } = useSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Exchange the one-time code from the reset email link for a session
  useEffect(() => {
    if (!supabase) return
    const code = searchParams.get('code')
    if (!code) {
      toast.error("Invalid reset link", { description: "No reset code found. Please request a new link." })
      setIsExchanging(false)
      return
    }
    supabase.auth.exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) {
          toast.error("Invalid or expired link", { description: "Please request a new password reset link." })
        } else {
          setSessionReady(true)
        }
      })
      .finally(() => setIsExchanging(false))
  }, [supabase, searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.")
      return
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.")
      return
    }
    setIsSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        toast.error("Failed to update password", { description: error.message })
      } else {
        toast.success("Password updated successfully!")
        router.push("/login")
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isExchanging || !supabase) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <IconLoader className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Set new password</CardTitle>
          <CardDescription className="text-center">
            {sessionReady
              ? "Enter your new password below."
              : "This reset link is invalid or has expired."}
          </CardDescription>
        </CardHeader>
        {sessionReady && (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update password"}
              </Button>
            </CardFooter>
          </form>
        )}
        <CardFooter className="flex justify-center">
          <div className="text-sm text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
