"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, LogOut } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"
import type { AuthError } from "@supabase/supabase-js"
import { appLogger, statusLogger } from '@/lib/logger'

export default function ProfilePage() {
  const { user, signOut, loading: authLoading } = useAuth()
  const router = useRouter()
  const [signOutLoading, setSignOutLoading] = useState(false)

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        const callbackUrl = encodeURIComponent('/profile');
        appLogger.info("Profile page: User not authenticated, redirecting to login.");
        router.push(`/login?callbackUrl=${callbackUrl}`);
      }
    }
  }, [authLoading, user, router]);

  const handleSignOut = async () => {
    setSignOutLoading(true)
    const { error } = await signOut()

    if (error) {
      appLogger.error("Error signing out:", error)
      if (error instanceof Error) {
        toast.error(error.message || "An unexpected error occurred during sign out.")
      } else {
        const errorMessage = (error as AuthError)?.message || "Sign out failed. Please try again.";
        toast.error(errorMessage)
      }
      setSignOutLoading(false)
    } else {
      toast.success("Signed out successfully.")
    }
  }

  if (authLoading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
           <h1 className="text-2xl font-bold">Profile</h1>
        </div>
        <div className="max-w-2xl mx-auto text-center">
          Loading profile...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
           <h1 className="text-2xl font-bold">Profile</h1>
        </div>
        <div className="max-w-2xl mx-auto text-center">
          Redirecting to login...
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Link href="/" className="mr-4">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Profile</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>User Profile</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>
                <strong>Email:</strong> {user.email}
              </p>
              <p>
                <strong>User ID:</strong> {user.id}
              </p>
              <p>
                <strong>Last Sign In:</strong>{" "}
                {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "N/A"}
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="destructive" onClick={handleSignOut} disabled={signOutLoading}>
              <LogOut className="mr-2 h-4 w-4" />
              {signOutLoading ? "Signing out..." : "Sign Out"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>App Settings</CardTitle>
            <CardDescription>Manage your application preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You can change your language preferences and voice settings in the settings page.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push("/settings")}>Go to Settings</Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}

