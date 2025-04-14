"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { TTSToggleButton } from "@/components/tts-toggle-button"
import { SettingsButton } from "@/components/settings-button"
import { UserNavButton } from "@/components/user-nav"
import { TagsButton } from "@/components/tags-button"
import Image from 'next/image';

export function Header() {
  const pathname = usePathname()
  
  // Don't show header on login page
  if (pathname === "/login") {
    return null
  }

  return (
    <header className="flex justify-between items-center mb-6">
      <Link href="/" className="flex items-center gap-2 group">
        <Image 
          src="/favicon.svg"
          alt="StudyCards Logo" 
          width={28}
          height={28}
          className="transition-transform group-hover:scale-110"
        />
        <h1 className="text-3xl font-bold group-hover:text-primary transition-colors">
          StudyCards
        </h1>
      </Link>
      <div className="flex items-center space-x-2">
        <TTSToggleButton />
        <SettingsButton />
        <TagsButton />
        <UserNavButton />
      </div>
    </header>
  )
} 