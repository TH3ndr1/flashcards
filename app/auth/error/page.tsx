"use client"

import Link from "next/link"

export default function AuthError() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-4">Authentication Error</h1>
        <p className="text-gray-600 mb-6">
          There was a problem verifying your email. Please try again or contact support if the problem persists.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          Return to Home
        </Link>
      </div>
    </div>
  )
} 