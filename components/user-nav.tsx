"use client"

import { User, Baby } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useFeatureFlags } from "@/hooks/useFeatureFlags"

export function UserNavButton() {
  const router = useRouter()
  const { isChildMode } = useFeatureFlags()

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/profile")}
          >
            {isChildMode ? (
              <Baby className="h-5 w-5" />
            ) : (
              <User className="h-5 w-5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isChildMode ? "Child Profile" : "Profile"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
} 