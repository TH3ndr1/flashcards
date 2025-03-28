"use client"

import { Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useSettings } from "@/hooks/use-settings"

export function TTSToggleButton() {
  const { settings, updateSettings } = useSettings()

  const toggleTTS = () => {
    updateSettings({ ttsEnabled: !settings?.ttsEnabled })
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTTS}
          >
            {settings?.ttsEnabled ? (
              <Volume2 className="h-5 w-5" />
            ) : (
              <VolumeX className="h-5 w-5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{settings?.ttsEnabled ? 'Disable' : 'Enable'} text-to-speech</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
} 