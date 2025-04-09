'use client'

import { Tags } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * A button component that navigates to the tag management page.
 */
export function TagsButton() {
  const router = useRouter()

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/tags")} // Navigate to /tags page
            aria-label="Manage Tags"
          >
            <Tags className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Manage Tags</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
} 