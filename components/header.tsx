"use client"

import { usePathname } from "next/navigation"
import { TTSToggleButton } from "@/components/tts-toggle-button"
import { SettingsButton } from "@/components/settings-button"
import { UserNavButton } from "@/components/user-nav"
import { TagsButton } from "@/components/tags-button"

export function Header() {
  const pathname = usePathname()
  
  // Don't show header on login page
  if (pathname === "/login") {
    return null
  }

  return (
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-3xl font-bold">StudyCards</h1>
      <div className="flex items-center space-x-2">
        <TTSToggleButton />
        <SettingsButton />
        <TagsButton />
        <UserNavButton />
      </div>
    </div>
  )
} 