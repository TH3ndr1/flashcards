"use client"

import { useEffect, useState, useRef, useMemo, useCallback } from "react"
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
  const initialized = useRef(false)

  const [appLanguage, setAppLanguage] = useState<string>("english")
  const [preferredVoices, setPreferredVoices] = useState<{
    english: string | null
    dutch: string | null
    french: string | null
  }>({
    english: null,
    dutch: null,
    french: null,
  })

  // Memoize filtered voices to prevent unnecessary recalculations and remove duplicates
  const filteredVoices = useMemo(() => {
    const uniqueVoices = (voices: SpeechSynthesisVoice[]) => {
      const seen = new Set<string>()
      return voices.filter(voice => {
        const key = `${voice.name}-${voice.lang}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }

    return {
      english: uniqueVoices(voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"))),
      dutch: uniqueVoices(voices.filter((voice) => voice.lang.toLowerCase().startsWith("nl"))),
      french: uniqueVoices(voices.filter((voice) => voice.lang.toLowerCase().startsWith("fr"))),
    }
  }, [voices])

  // Load settings
  useEffect(() => {
    if (!settingsLoading && settings) {
      setAppLanguage(settings.appLanguage || "english")
      if (settings.preferredVoices) {
        setPreferredVoices(settings.preferredVoices)
      }
    }
  }, [settings, settingsLoading])

  // Set default preferred voices only once when voices are loaded
  useEffect(() => {
    if (initialized.current || voicesLoading || voices.length === 0) {
      return
    }

    const defaultVoices = {
      english: null,
      dutch: null,
      french: null,
    }

    // Set default English voice (Karen)
    if (filteredVoices.english.length > 0) {
      const karenVoice = filteredVoices.english.find((v) => v.name.toLowerCase().includes("karen"))
      defaultVoices.english = karenVoice?.voiceURI || filteredVoices.english[0].voiceURI
    }

    // Set default Dutch voice (Ellen or Xander)
    if (filteredVoices.dutch.length > 0) {
      const ellenVoice = filteredVoices.dutch.find((v) => v.name.toLowerCase().includes("ellen"))
      const xanderVoice = filteredVoices.dutch.find((v) => v.name.toLowerCase().includes("xander"))
      defaultVoices.dutch = ellenVoice?.voiceURI || xanderVoice?.voiceURI || filteredVoices.dutch[0].voiceURI
    }

    // Set default French voice (Amélie or Thomas)
    if (filteredVoices.french.length > 0) {
      const amelieVoice = filteredVoices.french.find((v) => v.name.toLowerCase().includes("amélie"))
      const thomasVoice = filteredVoices.french.find((v) => v.name.toLowerCase().includes("thomas"))
      defaultVoices.french = amelieVoice?.voiceURI || thomasVoice?.voiceURI || filteredVoices.french[0].voiceURI
    }

    setPreferredVoices((prev) => ({
      ...prev,
      ...defaultVoices,
    }))

    initialized.current = true
  }, [voices, voicesLoading, filteredVoices])

  // Get voice name by URI for display
  const getVoiceName = useCallback((voiceURI: string | null) => {
    if (!voiceURI) return ""
    const voice = voices.find((v) => v.voiceURI === voiceURI)
    return voice ? voice.name : ""
  }, [voices])

  const handleSave = async () => {
    try {
      await updateSettings({
        appLanguage,
        preferredVoices,
      })

      toast({
        title: "Settings saved",
        description: "Your preferences have been updated successfully.",
      })

      router.push("/")
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({
        title: "Error saving settings",
        description: "There was a problem saving your settings. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (settingsLoading || voicesLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Link href="/" className="mr-4">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>

      <div className="max-w-2xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>User Profile</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>
                <strong>Email:</strong> {user?.email || "Not signed in"}
              </p>
              {user && (
                <p>
                  <strong>User ID:</strong> {user.id}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Application Language</CardTitle>
            <CardDescription>Set the default language for the application</CardDescription>
          </CardHeader>
          <CardContent>
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
              <p className="text-sm text-muted-foreground col-span-4">
                This will be the default language for new decks and the application interface.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Voice Preferences</CardTitle>
            <CardDescription>Select your preferred voice for each language</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* English Voice */}
            <div className="grid gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="englishVoice" className="text-right">
                  English Voice
                </Label>
                <Select
                  value={preferredVoices.english || ""}
                  onValueChange={(value) => setPreferredVoices((prev) => ({ ...prev, english: value }))}
                >
                  <SelectTrigger id="englishVoice" className="col-span-3">
                    <SelectValue>
                      {getVoiceName(preferredVoices.english) || "Select voice"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {filteredVoices.english.length > 0 ? (
                      filteredVoices.english.map((voice) => (
                        <SelectItem key={`en-${voice.name}-${voice.lang}-${voice.voiceURI}`} value={voice.voiceURI}>
                          {voice.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-voice" disabled>
                        No English voices available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dutch Voice */}
            <div className="grid gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dutchVoice" className="text-right">
                  Dutch Voice
                </Label>
                <Select
                  value={preferredVoices.dutch || ""}
                  onValueChange={(value) => setPreferredVoices((prev) => ({ ...prev, dutch: value }))}
                >
                  <SelectTrigger id="dutchVoice" className="col-span-3">
                    <SelectValue>
                      {getVoiceName(preferredVoices.dutch) || "Select voice"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {filteredVoices.dutch.length > 0 ? (
                      filteredVoices.dutch.map((voice) => (
                        <SelectItem key={`nl-${voice.name}-${voice.lang}-${voice.voiceURI}`} value={voice.voiceURI}>
                          {voice.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-voice" disabled>
                        No Dutch voices available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* French Voice */}
            <div className="grid gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="frenchVoice" className="text-right">
                  French Voice
                </Label>
                <Select
                  value={preferredVoices.french || ""}
                  onValueChange={(value) => setPreferredVoices((prev) => ({ ...prev, french: value }))}
                >
                  <SelectTrigger id="frenchVoice" className="col-span-3">
                    <SelectValue>
                      {getVoiceName(preferredVoices.french) || "Select voice"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {filteredVoices.french.length > 0 ? (
                      filteredVoices.french.map((voice) => (
                        <SelectItem key={`fr-${voice.name}-${voice.lang}-${voice.voiceURI}`} value={voice.voiceURI}>
                          {voice.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-voice" disabled>
                        No French voices available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

