"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { useSettings } from "@/hooks/use-settings"
import { useTTS } from "@/hooks/use-tts"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

export default function SettingsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { settings, updateSettings, loading: settingsLoading } = useSettings()
  const { voices, loading: voicesLoading } = useTTS()
  const { toast } = useToast()

  const [appLanguage, setAppLanguage] = useState<string>("english")

  // Load settings
  useEffect(() => {
    if (!settingsLoading && settings) {
      setAppLanguage(settings.appLanguage || "english")
    }
  }, [settings, settingsLoading])

  const handleSave = async () => {
    try {
      await updateSettings({
        appLanguage,
      })

      toast({
        title: "Settings saved",
        description: "Your preferences have been updated.",
      })

      router.refresh()
    } catch (error) {
      console.error("Failed to save settings:", error)
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (settingsLoading || voicesLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>
        <div>Loading...</div>
      </div>
    )
  }

  // Group voices by language
  const voicesByLanguage = {
    english: voices.filter(v => v.lang.toLowerCase().startsWith('en')),
    dutch: voices.filter(v => v.lang.toLowerCase().startsWith('nl')),
    french: voices.filter(v => v.lang.toLowerCase().startsWith('fr')),
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <div className="flex items-center space-x-4">
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <Button onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Application Settings</CardTitle>
            <CardDescription>Configure your application preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* App Language */}
            <div className="grid gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="appLanguage" className="text-right">
                  Language
                </Label>
                <Select value={appLanguage} onValueChange={setAppLanguage}>
                  <SelectTrigger id="appLanguage" className="col-span-3">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="dutch">Dutch</SelectItem>
                    <SelectItem value="french">French</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Voice Settings</CardTitle>
            <CardDescription>Using Google Cloud Text-to-Speech for high-quality voices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p>This application uses Google Cloud Text-to-Speech for voice synthesis:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>English: High-quality US English voice</li>
                <li>Dutch: Natural-sounding Dutch voice</li>
                <li>French: Professional French voice</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-4">
                These voices are automatically selected based on your language preference and provide consistent,
                high-quality speech powered by Google&apos;s advanced neural networks.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

