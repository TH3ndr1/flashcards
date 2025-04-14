import { HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export const EASY_CUTOFF = 0.40;
export const MEDIUM_CUTOFF = 0.58;

interface DifficultyIndicatorProps {
  difficultyScore: number | null
  className?: string
}

export function DifficultyIndicator({ difficultyScore, className }: DifficultyIndicatorProps) {
  if (difficultyScore === null) {
    return (
      <div className={cn("flex items-center gap-1 text-muted-foreground", className)}>
        <HelpCircle className="h-4 w-4" />
        <span className="text-xs">Unknown</span>
      </div>
    )
  }

  let color: string
  let label: string
  let emoji: string

  if (difficultyScore === 0) {
    color = "text-gray-500"
    label = "Freshly Cracked"
    emoji = "🐣"
  } else if (difficultyScore < EASY_CUTOFF) {
    color = "text-green-500"
    label = "Easy Peasy"
    emoji = "🍋"
  } else if (difficultyScore < MEDIUM_CUTOFF) {
    color = "text-yellow-500"
    label = "Tricky Nut"
    emoji = "🥜"
  } else {
    color = "text-amber-800"
    label = "Tough Cookie"
    emoji = "🍪"
  }

  return (
    <div className={cn("flex items-center gap-1", color, className)}>
      <span className="text-base leading-none">{emoji}</span>
      <span className="text-xs">{label}</span>
    </div>
  )
} 