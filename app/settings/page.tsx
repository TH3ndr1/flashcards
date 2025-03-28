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
import type { Settings } from "@/hooks/use-settings";
import { useTTS } from "@/hooks/use-tts";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { settings, updateSettings, loading: settingsLoading } = useSettings();
  const { voices, loading: voicesLoading } = useTTS();
  const { toast } = useToast();

  const [appLanguage, setAppLanguage] = useState<string>("en");
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

  const handleSave = async () => {
    try {
      await updateSettings({
        appLanguage,
        languageDialects,
      });
      toast({
        title: "Settings saved",
        description: "Your preferences have been updated.",
      });
      router.refresh();
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (settingsLoading || voicesLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>
        <div>Loading...</div>
      </div>
    );
  }

  // Group voices by language
  const voicesByLanguage = {
    english: voices.filter(v => v.lang.toLowerCase().startsWith("en")),
    dutch: voices.filter(v => v.lang.toLowerCase().startsWith("nl")),
    french: voices.filter(v => v.lang.toLowerCase().startsWith("fr")),
  };

  const onValueChange = (key: keyof Settings['languageDialects']) => (value: string) => {
    setLanguageDialects(prev => ({...prev, [key]: value}));
  };

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
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="nl">Dutch</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="it">Italian</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Language Dialects</CardTitle>
            <CardDescription>Choose your preferred dialect for each language</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium">Text-to-Speech</h3>
                  <p className="text-sm text-muted-foreground">
                    Enable or disable text-to-speech functionality
                  </p>
                </div>
                <Switch
                  checked={settings?.ttsEnabled ?? true}
                  onCheckedChange={(checked) => updateSettings({ ttsEnabled: checked })}
                />
              </div>

              {/* English Dialect */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dialectEn" className="text-right">
                  English Dialect
                </Label>
                <Select 
                  value={languageDialects.en} 
                  onValueChange={onValueChange('en')}
                >
                  <SelectTrigger id="dialectEn" className="col-span-3">
                    <SelectValue placeholder="Select English dialect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-GB">English (United Kingdom)</SelectItem>
                    <SelectItem value="en-US">English (United States)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Dutch Dialect */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dialectNl" className="text-right">
                  Dutch Dialect
                </Label>
                <Select 
                  value={languageDialects.nl} 
                  onValueChange={onValueChange('nl')}
                >
                  <SelectTrigger id="dialectNl" className="col-span-3">
                    <SelectValue placeholder="Select Dutch dialect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nl-NL">Dutch (Netherlands)</SelectItem>
                    <SelectItem value="nl-BE">Dutch (Belgium)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* French Dialect */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dialectFr" className="text-right">
                  French Dialect
                </Label>
                <Select 
                  value={languageDialects.fr} 
                  onValueChange={onValueChange('fr')}
                >
                  <SelectTrigger id="dialectFr" className="col-span-3">
                    <SelectValue placeholder="Select French dialect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr-FR">French (France)</SelectItem>
                    <SelectItem value="fr-BE">French (Belgium)</SelectItem>
                    <SelectItem value="fr-CH">French (Switzerland)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* German Dialect */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dialectDe" className="text-right">
                  German Dialect
                </Label>
                <Select 
                  value={languageDialects.de} 
                  onValueChange={onValueChange('de')}
                >
                  <SelectTrigger id="dialectDe" className="col-span-3">
                    <SelectValue placeholder="Select German dialect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de-DE">German (Germany)</SelectItem>
                    <SelectItem value="de-AT">German (Austria)</SelectItem>
                    <SelectItem value="de-CH">German (Switzerland)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Spanish Dialect */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dialectEs" className="text-right">
                  Spanish Dialect
                </Label>
                <Select 
                  value={languageDialects.es} 
                  onValueChange={onValueChange('es')}
                >
                  <SelectTrigger id="dialectEs" className="col-span-3">
                    <SelectValue placeholder="Select Spanish dialect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es-ES">Spanish (Spain)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Italian Dialect */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dialectIt" className="text-right">
                  Italian Dialect
                </Label>
                <Select 
                  value={languageDialects.it} 
                  onValueChange={onValueChange('it')}
                >
                  <SelectTrigger id="dialectIt" className="col-span-3">
                    <SelectValue placeholder="Select Italian dialect" />
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
  );
}