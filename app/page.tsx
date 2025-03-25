"use client"

import { useEffect, useState } from "react"
import { DeckList } from "@/components/deck-list"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Settings, User } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)
  const [redirected, setRedirected] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  // Set isClient to true when component mounts
  useEffect(() => {
    setIsClient(true)

    // Handle visibility changes
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden)
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
      setIsVisible(!document.hidden)
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
  }, [])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (isClient && !loading && !user && !redirected) {
      setRedirected(true)
      router.push("/login")
    }
  }, [user, loading, router, isClient, redirected])

  if (!isClient || loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div 
          className={`h-12 w-12 rounded-full border-2 border-primary ${isVisible ? 'animate-spin border-b-transparent' : ''}`}
          style={{ 
            animation: isVisible ? 'spin 1s linear infinite' : 'none',
            borderBottomColor: 'transparent' 
          }}
        />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div 
          className={`h-12 w-12 rounded-full border-2 border-primary ${isVisible ? 'animate-spin border-b-transparent' : ''}`}
          style={{ 
            animation: isVisible ? 'spin 1s linear infinite' : 'none',
            borderBottomColor: 'transparent' 
          }}
        />
      </div>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">StudyCards</h1>
        <div className="flex space-x-2">
          <Button variant="outline" size="icon" onClick={() => router.push("/settings")}>
            <Settings className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => router.push("/profile")}>
            <User className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <DeckList />
    </main>
  )
}

