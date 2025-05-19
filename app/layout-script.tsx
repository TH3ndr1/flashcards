"use client"

import { useEffect } from "react"
import { appLogger, statusLogger } from '@/lib/logger'

export default function LayoutScript() {
  useEffect(() => {
    // Only register service worker in production and when in a browser context
    // that supports service workers
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Check if we're in a development/preview environment
      const isPreviewEnvironment =
        window.location.hostname.includes("vusercontent.net") ||
        window.location.hostname.includes("vercel.app") ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"

      if (isPreviewEnvironment) {
        appLogger.info("Service Worker registration skipped in preview/development environment")
        return
      }

      // Only register in production environments
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            appLogger.info("Service Worker registered with scope:", registration.scope)
          })
          .catch((error) => {
            appLogger.error("Service Worker registration failed:", error)
            // Continue app execution even if service worker fails
          })
      })
    }
  }, [])

  return null
}

