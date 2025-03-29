// File: /app/settings/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import type { Settings, FontOption } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { FONT_OPTIONS } from "@/lib/fonts";

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { settings, updateSettings, loading: settingsLoading } = useSettings();
  const { toast } = useToast();

  const [appLanguage, setAppLanguage] = useState<string>("en");
  const [cardFont, setCardFont] = useState<FontOption>("default");
  const [masteryThreshold, setMasteryThreshold] = useState<number>(3);
  const [languageDialects, setLanguageDialects] = useState<Settings['languageDialects']>({
    en: 'en-GB',
    nl: 'nl-NL',
    fr: 'fr-FR',
    de: 'de-DE',
    es: 'es-ES',
    it: 'it-IT',
  });

  // Load settings
  useEffect(() => {
    if (!settingsLoading && settings) {
      setAppLanguage(settings.appLanguage || "en");
      setCardFont(settings.cardFont || "default");
      setMasteryThreshold(settings.masteryThreshold || 3);
      setLanguageDialects(settings.languageDialects || {
        en: 'en-GB',
        nl: 'nl-NL',
        fr: 'fr-FR',
        de: 'de-DE',
        es: 'es-ES',
        it: 'it-IT',
      });
    }
  }, [settings, settingsLoading]);

  // Auto-save settings when they change
  const handleSettingChange = async (updates: Partial<Settings>) => {
    try {
      await updateSettings(updates);
      toast({
        title: "Settings updated",
        description: "Your changes have been saved.",
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const onValueChange = (key: keyof Settings['languageDialects']) => async (value: string) => {
    const newDialects = { ...languageDialects, [key]: value };
    setLanguageDialects(newDialects);
    await handleSettingChange({ languageDialects: newDialects });
  };

  const handleLanguageChange = async (value: string) => {
    setAppLanguage(value);
    await handleSettingChange({ appLanguage: value });
  };

  // Handle font change
  const handleFontChange = async (value: FontOption) => {
    setCardFont(value);
    try {
      await updateSettings({ cardFont: value });
    } catch (error) {
      console.error('Failed to update font:', error);
      // Revert to previous value if update fails
      setCardFont(settings?.cardFont || "default");
    }
  };

  if (settingsLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Application Settings</CardTitle>
            <CardDescription>Configure your application preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="appLanguage" className="text-right">
                  Language
                </Label>
                <Select value={appLanguage} onValueChange={handleLanguageChange}>
                  <SelectTrigger id="appLanguage" className="col-span-3">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="nl">Dutch</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="it">Italian</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="cardFont" className="text-right">
                  Card Font
                </Label>
                <Select value={cardFont} onValueChange={handleFontChange}>
                  <SelectTrigger id="cardFont" className="col-span-3">
                    <SelectValue placeholder="Select font" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(FONT_OPTIONS) as [FontOption, typeof FONT_OPTIONS[keyof typeof FONT_OPTIONS]][]).map(([key, font]) => (
                      <SelectItem 
                        key={key} 
                        value={key}
                        style={{ 
                          fontFamily: key === 'default' ? 'var(--font-sans)' : 
                            key === 'opendyslexic' ? "'OpenDyslexic', system-ui, sans-serif" : 
                            "'Atkinson Hyperlegible', system-ui, sans-serif"
                        }}
                      >
                        {font.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="masteryThreshold" className="text-right">
                  Mastery Threshold
                </Label>
                <div className="col-span-3 flex items-center gap-4">
                  <Input
                    id="masteryThreshold"
                    type="number"
                    min={1}
                    max={10}
                    value={settings?.masteryThreshold ?? 3}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (value >= 1 && value <= 10) {
                        handleSettingChange({ masteryThreshold: value });
                      }
                    }}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">
                    Correct answers needed to master a card (1-10)
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium">Show Difficulty Indicators</h3>
                  <p className="text-sm text-muted-foreground">
                    Display difficulty level indicators on flashcards
                  </p>
                </div>
                <Switch
                  checked={settings?.showDifficulty ?? true}
                  onCheckedChange={(checked) => handleSettingChange({ showDifficulty: checked })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Speech Settings</CardTitle>
            <CardDescription>Configure text-to-speech and language preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">Text-to-Speech</h3>
                <p className="text-sm text-muted-foreground">
                  Enable or disable text-to-speech functionality
                </p>
              </div>
              <Switch
                checked={settings?.ttsEnabled ?? true}
                onCheckedChange={(checked) => handleSettingChange({ ttsEnabled: checked })}
              />
            </div>

            <div className="grid gap-4">
              {/* English */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dialectEn" className="text-right">
                  English
                </Label>
                <Select 
                  value={languageDialects.en} 
                  onValueChange={onValueChange('en')}
                >
                  <SelectTrigger id="dialectEn" className="col-span-3">
                    <SelectValue placeholder="Select English variant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-GB">English (United Kingdom)</SelectItem>
                    <SelectItem value="en-US">English (United States)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Dutch */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dialectNl" className="text-right">
                  Dutch
                </Label>
                <Select 
                  value={languageDialects.nl} 
                  onValueChange={onValueChange('nl')}
                >
                  <SelectTrigger id="dialectNl" className="col-span-3">
                    <SelectValue placeholder="Select Dutch variant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nl-NL">Dutch (Netherlands)</SelectItem>
                    <SelectItem value="nl-BE">Dutch (Belgium)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* French */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dialectFr" className="text-right">
                  French
                </Label>
                <Select 
                  value={languageDialects.fr} 
                  onValueChange={onValueChange('fr')}
                >
                  <SelectTrigger id="dialectFr" className="col-span-3">
                    <SelectValue placeholder="Select French variant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr-FR">French (France)</SelectItem>
                    <SelectItem value="fr-BE">French (Belgium)</SelectItem>
                    <SelectItem value="fr-CH">French (Switzerland)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* German */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dialectDe" className="text-right">
                  German
                </Label>
                <Select 
                  value={languageDialects.de} 
                  onValueChange={onValueChange('de')}
                >
                  <SelectTrigger id="dialectDe" className="col-span-3">
                    <SelectValue placeholder="Select German variant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de-DE">German (Germany)</SelectItem>
                    <SelectItem value="de-AT">German (Austria)</SelectItem>
                    <SelectItem value="de-CH">German (Switzerland)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Spanish */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dialectEs" className="text-right">
                  Spanish
                </Label>
                <Select 
                  value={languageDialects.es} 
                  onValueChange={onValueChange('es')}
                >
                  <SelectTrigger id="dialectEs" className="col-span-3">
                    <SelectValue placeholder="Select Spanish variant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es-ES">Spanish (Spain)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Italian */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dialectIt" className="text-right">
                  Italian
                </Label>
                <Select 
                  value={languageDialects.it} 
                  onValueChange={onValueChange('it')}
                >
                  <SelectTrigger id="dialectIt" className="col-span-3">
                    <SelectValue placeholder="Select Italian variant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="it-IT">Italian (Italy)</SelectItem>
                    <SelectItem value="it-CH">Italian (Switzerland)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}