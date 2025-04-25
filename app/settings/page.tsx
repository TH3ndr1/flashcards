// File: /app/settings/page.tsx
"use client";

import React, { useEffect, useState, useCallback, useRef } from "react"; // Keep imports from working version
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Palette, RotateCcw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
// --- Adjust imports to match the provider updates ---
import { useSettings, DEFAULT_SETTINGS as PROVIDER_DEFAULT_SETTINGS, DEFAULT_WORD_COLORS } from "@/providers/settings-provider";
import type { Settings, FontOption } from "@/providers/settings-provider"; // Should now include new toggles
// ---------------------------------------------------
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { FONT_OPTIONS } from "@/lib/fonts";
import { Separator } from "@/components/ui/separator";
import { debounce } from "@/lib/utils"; // Keep debounce

// Constants from the working version
const POS_OPTIONS: ReadonlyArray<string> = ['Noun', 'Verb', 'Adjective', 'Adverb', 'Pronoun', 'Preposition', 'Interjection', 'Other'] as const;
const GENDER_OPTIONS_LABELS: ReadonlyArray<string> = ['Male', 'Female', 'Neutral/Default'] as const;
const GENDER_KEYS: ReadonlyArray<string> = ['Male', 'Female', 'Default'] as const;
const GENDERED_POS: ReadonlyArray<string> = ['Noun', 'Adjective', 'Pronoun'] as const;
// --- Add Basic/Advanced POS lists ---
const BASIC_POS: ReadonlyArray<string> = ['Noun', 'Verb'] as const;
const ADVANCED_POS: ReadonlyArray<string> = ['Adjective', 'Adverb', 'Pronoun', 'Preposition', 'Interjection', 'Other'] as const;
// ----------------------------------
// Use DEFAULT_WORD_COLORS defined in this file or import if preferred
const LOCAL_DEFAULT_SETTINGS: Settings = {
    ...PROVIDER_DEFAULT_SETTINGS, // Ensure this has new toggle defaults
    wordColorConfig: DEFAULT_WORD_COLORS,
};


export default function SettingsPage() {
  // Hooks and State
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { settings, updateSettings, loading: settingsLoading } = useSettings();

  // State initialization
  const [appLanguage, setAppLanguage] = useState<string>(LOCAL_DEFAULT_SETTINGS.appLanguage);
  const [cardFont, setCardFont] = useState<FontOption>(LOCAL_DEFAULT_SETTINGS.cardFont);
  const [masteryThreshold, setMasteryThreshold] = useState<number>(LOCAL_DEFAULT_SETTINGS.masteryThreshold);
  const [languageDialects, setLanguageDialects] = useState<NonNullable<Settings['languageDialects']>>(
      LOCAL_DEFAULT_SETTINGS.languageDialects
  );
  const [showDifficulty, setShowDifficulty] = useState<boolean>(LOCAL_DEFAULT_SETTINGS.showDifficulty);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(LOCAL_DEFAULT_SETTINGS.ttsEnabled);
  // --- State for NEW separate toggles ---
  const [enableBasicColorCoding, setEnableBasicColorCoding] = useState<boolean>(LOCAL_DEFAULT_SETTINGS.enableBasicColorCoding);
  const [enableAdvancedColorCoding, setEnableAdvancedColorCoding] = useState<boolean>(LOCAL_DEFAULT_SETTINGS.enableAdvancedColorCoding);
  // -------------------------------------
  const [wordColorConfig, setWordColorConfig] = useState<NonNullable<Settings['wordColorConfig']>>(
      LOCAL_DEFAULT_SETTINGS.wordColorConfig
  );

  // Effects
  useEffect(() => { /* Redirect */
    if (!authLoading && !user) {
        const callbackUrl = encodeURIComponent('/settings');
        router.push(`/login?callbackUrl=${callbackUrl}`);
    }
   }, [authLoading, user, router]);

  useEffect(() => { /* Load Settings */
     if (!settingsLoading && user) {
         const currentSettings = settings ?? LOCAL_DEFAULT_SETTINGS;
         setAppLanguage(currentSettings.appLanguage);
         setCardFont(currentSettings.cardFont);
         setMasteryThreshold(currentSettings.masteryThreshold);
         setShowDifficulty(currentSettings.showDifficulty);
         setTtsEnabled(currentSettings.ttsEnabled);
         setLanguageDialects(currentSettings.languageDialects);
         // --- Load NEW Toggle States ---
         setEnableBasicColorCoding(currentSettings.enableBasicColorCoding);
         setEnableAdvancedColorCoding(currentSettings.enableAdvancedColorCoding);
         // ----------------------------
         setWordColorConfig({ ...DEFAULT_WORD_COLORS, ...(currentSettings.wordColorConfig ?? {}) });
     }
  }, [settings, settingsLoading, user]);

  // Handlers (Keep useCallback structure from working version)
  const handleSettingChange = useCallback(async (updates: Partial<Settings>) => {
    if (!user) { toast.error("Authentication Error"); return; }
    try { await updateSettings(updates); /* toast.success("Settings updated"); */ } // Maybe silence toast on every sub-change
    catch (error) { console.error("Failed to save settings:", error); toast.error("Error saving settings"); }
  }, [user, updateSettings]);

  const debouncedSaveColorConfig = useCallback(
    debounce((newConfig: NonNullable<Settings['wordColorConfig']>) => {
        handleSettingChange({ wordColorConfig: newConfig }).then(() => toast.success("Color settings saved.")); // Toast on actual save
    }, 800),
    [handleSettingChange]
  );

  const handleLanguageChange = useCallback(async (value: string) => { setAppLanguage(value); await handleSettingChange({ appLanguage: value }); }, [handleSettingChange]);
  const handleFontChange = useCallback(async (value: FontOption) => { setCardFont(value); await handleSettingChange({ cardFont: value }); }, [handleSettingChange]);
  const handleMasteryThresholdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value);
      if (!isNaN(value) && value >= 1 && value <= 10) {
          setMasteryThreshold(value);
          handleSettingChange({ masteryThreshold: value });
      } else if (e.target.value === '') {
          setMasteryThreshold(LOCAL_DEFAULT_SETTINGS.masteryThreshold);
          // handleSettingChange({ masteryThreshold: LOCAL_DEFAULT_SETTINGS.masteryThreshold });
      }
   }, [handleSettingChange]);
  const handleShowDifficultyChange = useCallback(async (checked: boolean) => { setShowDifficulty(checked); await handleSettingChange({ showDifficulty: checked }); }, [handleSettingChange]);
  const handleTtsEnabledChange = useCallback(async (checked: boolean) => { setTtsEnabled(checked); await handleSettingChange({ ttsEnabled: checked }); }, [handleSettingChange]);
  const handleDialectChange = useCallback((key: keyof NonNullable<Settings['languageDialects']>) => async (value: string) => {
      setLanguageDialects(prevDialects => {
          const newDialects = { ...prevDialects, [key]: value };
          handleSettingChange({ languageDialects: newDialects });
          return newDialects;
      });
   }, [handleSettingChange]);

  // --- NEW Handlers for separate toggles ---
  const handleEnableBasicChange = useCallback(async (checked: boolean) => {
      setEnableBasicColorCoding(checked);
      await handleSettingChange({ enableBasicColorCoding: checked });
      if(checked) toast.info("Basic color coding enabled."); else toast.info("Basic color coding disabled."); // Give feedback
  }, [handleSettingChange]);

  const handleEnableAdvancedChange = useCallback(async (checked: boolean) => {
      setEnableAdvancedColorCoding(checked);
      await handleSettingChange({ enableAdvancedColorCoding: checked });
       if(checked) toast.info("Advanced color coding enabled."); else toast.info("Advanced color coding disabled."); // Give feedback
  }, [handleSettingChange]);
  // --------------------------------------

  // Color Change Handler (Keep useCallback and debounce logic)
  const handleColorChange = useCallback((pos: string, genderKey: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const newColor = event.target.value;
      setWordColorConfig(prevConfig => {
           const currentConfig = prevConfig ?? DEFAULT_WORD_COLORS;
           const newConfig = JSON.parse(JSON.stringify(currentConfig));
           if (!newConfig[pos]) newConfig[pos] = {};
           newConfig[pos][genderKey] = newColor;
           debouncedSaveColorConfig(newConfig); // Use debounced save
           return newConfig;
      });
  }, [debouncedSaveColorConfig]);

  // Reset Colors Handler (Keep useCallback)
  const handleResetColors = useCallback(async () => {
      const defaultColors = { ...DEFAULT_WORD_COLORS };
      setWordColorConfig(defaultColors);
      // Save immediately, no need to debounce reset
      await handleSettingChange({ wordColorConfig: defaultColors });
      toast.info("Color settings reset to default.");
  }, [handleSettingChange]);

  // Loading/User checks
  if (settingsLoading || authLoading) { return <div className="container mx-auto p-8">Loading Settings...</div>; }
  if (!user) { return <div className="container mx-auto p-8">Redirecting to login...</div>; }

  // --- Render ---
  return (
    <div className="container mx-auto py-8"> {/* Original Container */}
      <div className="flex items-center justify-between mb-8"> {/* Original Header */}
        <h1 className="text-3xl font-bold">Settings</h1>
        <Button variant="outline" onClick={() => router.back()}> <ArrowLeft className="mr-2 h-4 w-4" /> Back </Button>
      </div>
      <div className="grid gap-6"> {/* Original Grid */}

        {/* Application Settings Card (Original Structure) */}
        <Card>
            <CardHeader> <CardTitle>Application Settings</CardTitle> <CardDescription>Configure your application preferences</CardDescription> </CardHeader>
            <CardContent className="space-y-6">
                 {/* Language, Font, Mastery, Rating Buttons... (Original Structure) */}
                 <div className="grid gap-4"> <div className="grid grid-cols-4 items-center gap-4"> <Label htmlFor="appLanguage" className="text-right">Language</Label> <Select value={appLanguage} onValueChange={handleLanguageChange}> <SelectTrigger id="appLanguage" className="col-span-3"><SelectValue placeholder="Select language" /></SelectTrigger> <SelectContent> <SelectItem value="en">English</SelectItem> <SelectItem value="nl">Dutch</SelectItem> <SelectItem value="fr">French</SelectItem> <SelectItem value="de">German</SelectItem> <SelectItem value="es">Spanish</SelectItem> <SelectItem value="it">Italian</SelectItem> </SelectContent> </Select> </div> <div className="grid grid-cols-4 items-center gap-4"> <Label htmlFor="cardFont" className="text-right">Card Font</Label> <Select value={cardFont} onValueChange={handleFontChange}> <SelectTrigger id="cardFont" className="col-span-3"><SelectValue placeholder="Select font" /></SelectTrigger> <SelectContent> {(Object.entries(FONT_OPTIONS) as [FontOption, { name: string; [key: string]: any }][]).map(([key, font]) => ( <SelectItem key={key} value={key} style={{ fontFamily: key === 'default' ? 'var(--font-sans)' : key === 'opendyslexic' ? "'OpenDyslexic', system-ui, sans-serif" : "'Atkinson Hyperlegible', system-ui, sans-serif" }} > {font.name} </SelectItem> ))} </SelectContent> </Select> </div> <div className="grid grid-cols-4 items-center gap-4"> <Label htmlFor="masteryThreshold" className="text-right">Mastery Threshold</Label> <div className="col-span-3 flex items-center gap-4"> <Input id="masteryThreshold" type="number" min={1} max={10} value={masteryThreshold} onChange={handleMasteryThresholdChange} className="w-24" /> <span className="text-sm text-muted-foreground">Correct answers needed to master (1-10)</span> </div> </div> </div> <div className="flex items-center justify-between p-4 border rounded-lg"> <div> <h3 className="font-medium">Show Rating Buttons</h3> <p className="text-sm text-muted-foreground">Display Again/Hard/Good/Easy buttons</p> </div> <Switch checked={showDifficulty} onCheckedChange={handleShowDifficultyChange} /> </div>
            </CardContent>
        </Card>

        {/* Speech Settings Card (Original Structure) */}
        <Card>
            <CardHeader> <CardTitle>Speech Settings</CardTitle> <CardDescription>Configure text-to-speech and language preferences</CardDescription> </CardHeader>
            <CardContent className="space-y-6">
                 {/* TTS Toggle and Dialect Selectors... (Original Structure) */}
                 <div className="flex items-center justify-between p-4 border rounded-lg"> <div> <h3 className="font-medium">Text-to-Speech</h3> <p className="text-sm text-muted-foreground">Enable audio playback for cards</p> </div> <Switch checked={ttsEnabled} onCheckedChange={handleTtsEnabledChange}/> </div> {ttsEnabled && ( <> <Separator /> <div className="grid gap-4 pt-4"> {(Object.keys(languageDialects) as Array<keyof typeof languageDialects>).map((langKey) => ( <div key={langKey} className="grid grid-cols-4 items-center gap-4"> <Label htmlFor={`dialect-${langKey}`} className="text-right capitalize">{ { en: 'English', nl: 'Dutch', fr: 'French', de: 'German', es: 'Spanish', it: 'Italian' }[langKey] ?? langKey }</Label> <Select value={languageDialects[langKey] ?? ''} onValueChange={handleDialectChange(langKey)}> <SelectTrigger id={`dialect-${langKey}`} className="col-span-3"><SelectValue /></SelectTrigger> <SelectContent> {langKey === 'en' && <> <SelectItem value="en-GB">English (UK)</SelectItem> <SelectItem value="en-US">English (US)</SelectItem> </>} {langKey === 'nl' && <> <SelectItem value="nl-NL">Dutch (NL)</SelectItem> <SelectItem value="nl-BE">Dutch (BE)</SelectItem> </>} {langKey === 'fr' && <> <SelectItem value="fr-FR">French (FR)</SelectItem> <SelectItem value="fr-BE">French (BE)</SelectItem> <SelectItem value="fr-CH">French (CH)</SelectItem> </>} {langKey === 'de' && <> <SelectItem value="de-DE">German (DE)</SelectItem> <SelectItem value="de-AT">German (AT)</SelectItem> <SelectItem value="de-CH">German (CH)</SelectItem> </>} {langKey === 'es' && <> <SelectItem value="es-ES">Spanish (ES)</SelectItem> </>} {langKey === 'it' && <> <SelectItem value="it-IT">Italian (IT)</SelectItem> <SelectItem value="it-CH">Italian (CH)</SelectItem> </>} </SelectContent> </Select> </div> ))} </div> </> )}
            </CardContent>
        </Card>

        {/* --- Word Color Coding Card (Integrate new logic into old structure) --- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Word Color Coding</CardTitle>
            <CardDescription>Set background colors for words based on grammar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Section 1: Basic Toggle and Settings */}
            <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                     <div>
                         <h3 className="font-medium">Basic Color Coding (Nouns & Verbs)</h3>
                         <p className="text-sm text-muted-foreground">Highlight common word types.</p>
                     </div>
                     <Switch checked={enableBasicColorCoding} onCheckedChange={handleEnableBasicChange}/>
                </div>
                {/* Render Basic Pickers if enabled */}
                {enableBasicColorCoding && (
                    <div className="pl-2 space-y-4">
                        {BASIC_POS.map(pos => (
                             <div key={pos}>
                                 <Label className="font-semibold text-base mb-2 block">{pos}</Label>
                                 <div className={`grid grid-cols-2 ${pos === 'Noun' ? 'sm:grid-cols-3' : 'sm:grid-cols-1'} gap-x-4 gap-y-3 items-center`}>
                                     {(pos === 'Noun' ? GENDER_KEYS : ['Default']).map((genderKey, index) => (
                                         <div key={genderKey} className="flex items-center gap-2">
                                             <Label htmlFor={`color-${pos}-${genderKey}`} className="text-sm w-20 text-right flex-shrink-0">
                                                 {pos === 'Noun' ? GENDER_OPTIONS_LABELS[index] : 'Neutral / Other'}
                                             </Label>
                                             <Input type="color" id={`color-${pos}-${genderKey}`} value={wordColorConfig?.[pos]?.[genderKey] ?? '#ffffff'} onChange={handleColorChange(pos, genderKey)} className="w-10 h-8 p-0 border rounded cursor-pointer" title={`Color for ${pos} (${pos === 'Noun' ? GENDER_OPTIONS_LABELS[index] : 'Neutral / Other'})`} />
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         ))}
                    </div>
                )}
            </div>

             {/* Section 2: Advanced Toggle and Settings */}
             <div className="border rounded-lg p-4 space-y-4">
                 <div className="flex items-center justify-between">
                     <div>
                         <h3 className="font-medium">Advanced Color Coding</h3>
                         <p className="text-sm text-muted-foreground">Configure colors for other word types.</p>
                     </div>
                     <Switch checked={enableAdvancedColorCoding} onCheckedChange={handleEnableAdvancedChange}/>
                 </div>
                 {/* Render Advanced Pickers if enabled */}
                 {enableAdvancedColorCoding && (
                     <div className="pl-2 space-y-4">
                        {ADVANCED_POS.map(pos => {
                            const isGendered = GENDERED_POS.includes(pos);
                            const relevantGenders = isGendered ? GENDER_KEYS : ['Default'];
                            const relevantLabels = isGendered ? GENDER_OPTIONS_LABELS : ['Neutral / Other'];
                            return (
                                <div key={pos}>
                                    <Label className="font-semibold text-base mb-2 block">{pos}</Label>
                                    <div className={`grid grid-cols-2 ${isGendered ? 'sm:grid-cols-3' : 'sm:grid-cols-1'} gap-x-4 gap-y-3 items-center`}>
                                        {relevantGenders.map((genderKey, index) => (
                                            <div key={genderKey} className="flex items-center gap-2">
                                                <Label htmlFor={`color-${pos}-${genderKey}`} className="text-sm w-24 text-right flex-shrink-0">
                                                    {relevantLabels[index]}
                                                </Label>
                                                <Input type="color" id={`color-${pos}-${genderKey}`} value={wordColorConfig?.[pos]?.[genderKey] ?? '#ffffff'} onChange={handleColorChange(pos, genderKey)} className="w-10 h-8 p-0 border rounded cursor-pointer" title={`Color for ${pos} (${relevantLabels[index]})`} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                     </div>
                 )}
             </div>

              {/* Reset Button (Keep original position relative to the color config section) */}
             <div className="flex justify-end pt-4">
                 <Button variant="outline" size="sm" onClick={handleResetColors}>
                     <RotateCcw className="h-4 w-4 mr-2" />
                     Reset Color Defaults
                 </Button>
             </div>
          </CardContent>
        </Card>
        {/* --------------------------------------------------------------------- */}

      </div>
    </div>
  );
}