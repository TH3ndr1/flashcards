"use client"

import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * Custom hook for detecting mobile device state.
 * 
 * This hook provides:
 * - Mobile device detection
 * - Responsive state management
 * - Window resize handling
 * 
 * @returns {boolean} Whether the current device is considered mobile
 */
export function useMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
