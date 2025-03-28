"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { Card } from "@/components/ui/card"
import { DeckList } from "@/components/deck-list"

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

