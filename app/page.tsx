"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { Card } from "@/components/ui/card"
import { DeckList } from "@/components/deck-list"

/**
 * Home page component.
 *
 * This page is protected and requires authentication. It checks the user's
 * authentication status using the `useAuth` hook. If the user is not authenticated
 * or the auth state is loading, it redirects to the '/login' page or shows
 * a loading state (null). Once authenticated, it displays the user's decks
 * using the `DeckList` component.
 *
 * @returns {JSX.Element | null} The Home page UI or null if loading/unauthenticated.
 */
export default function Home() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    // Only redirect if we're not loading and there's no user
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, router, loading])

  // Show nothing while loading or if no user
  if (loading || !user) {
    return null
  }

  return (
    <div className="grid gap-4">
      <DeckList />
    </div>
  )
}

