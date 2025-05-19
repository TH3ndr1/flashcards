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
// --- Adjust imports for Palette ---
import { useSettings, DEFAULT_SETTINGS as PROVIDER_DEFAULT_SETTINGS } from "@/providers/settings-provider";
import type { Settings, FontOption, ThemePreference } from "@/providers/settings-provider"; // Now includes wordPaletteConfig
import { PREDEFINED_PALETTES, DEFAULT_PALETTE_CONFIG } from "@/lib/palettes"; // Import palette data
import type { Palette as PaletteType } from "@/lib/palettes"; // Import Palette type
// ---------------------------------
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { FONT_OPTIONS } from "@/lib/fonts";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "next-themes"; // Import useTheme
import { appLogger, statusLogger } from '@/lib/logger';
// Debounce likely not needed for Selects, removing for simplicity unless proven necessary
// import { debounce } from "@/lib/utils";

// Constants (Keep all from previous working version)
const POS_OPTIONS: ReadonlyArray<string> = ['Noun', 'Verb', 'Adjective', 'Adverb', 'Pronoun', 'Preposition', 'Interjection', 'Other'] as const;
const GENDER_OPTIONS_LABELS: ReadonlyArray<string> = ['Male', 'Female', 'Neutral / Other'] as const; // Use refined label
const GENDER_KEYS: ReadonlyArray<string> = ['Male', 'Female', 'Default'] as const;
const GENDERED_POS: ReadonlyArray<string> = ['Noun', 'Adjective', 'Pronoun'] as const;
const BASIC_POS: ReadonlyArray<string> = ['Noun', 'Verb'] as const;
const ADVANCED_POS: ReadonlyArray<string> = ['Adjective', 'Adverb', 'Pronoun', 'Preposition', 'Interjection', 'Other'] as const;

// Use local defaults based on provider defaults (now includes palette config)
const LOCAL_DEFAULT_SETTINGS: Settings = {
    ...PROVIDER_DEFAULT_SETTINGS, // Should have correct enable flags
    wordPaletteConfig: DEFAULT_PALETTE_CONFIG, // Use palette default
};


export default function SettingsPage() {
  // Hooks and State
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { settings, updateSettings, loading: settingsLoading } = useSettings();
  const { setTheme } = useTheme(); // Get setTheme function

  // State initialization (Keep all existing state variables)
  const [appLanguage, setAppLanguage] = useState<string>(LOCAL_DEFAULT_SETTINGS.appLanguage);
  const [cardFont, setCardFont] = useState<FontOption>(LOCAL_DEFAULT_SETTINGS.cardFont);
  const [masteryThreshold, setMasteryThreshold] = useState<number>(LOCAL_DEFAULT_SETTINGS.masteryThreshold);
  const [languageDialects, setLanguageDialects] = useState<NonNullable<Settings['languageDialects']>>(
      LOCAL_DEFAULT_SETTINGS.languageDialects
  );
  const [showDifficulty, setShowDifficulty] = useState<boolean>(LOCAL_DEFAULT_SETTINGS.showDifficulty);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(LOCAL_DEFAULT_SETTINGS.ttsEnabled);
  const [colorOnlyNonNative, setColorOnlyNonNative] = useState<boolean>(LOCAL_DEFAULT_SETTINGS.colorOnlyNonNative);
  const [enableBasicColorCoding, setEnableBasicColorCoding] = useState<boolean>(LOCAL_DEFAULT_SETTINGS.enableBasicColorCoding);
  const [enableAdvancedColorCoding, setEnableAdvancedColorCoding] = useState<boolean>(LOCAL_DEFAULT_SETTINGS.enableAdvancedColorCoding);
  // --- State uses Palette Config ---
  const [wordPaletteConfig, setWordPaletteConfig] = useState<NonNullable<Settings['wordPaletteConfig']>>(
      LOCAL_DEFAULT_SETTINGS.wordPaletteConfig
  );
  // --- Add state for new setting ---
  const [showDeckProgress, setShowDeckProgress] = useState<boolean>(LOCAL_DEFAULT_SETTINGS.showDeckProgress);
  const [themePreference, setThemePreference] = useState<ThemePreference>(LOCAL_DEFAULT_SETTINGS.themePreference);
  // --------------------------------

  // Effects (Keep original logic)
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
         setColorOnlyNonNative(currentSettings.colorOnlyNonNative);
         setEnableBasicColorCoding(currentSettings.enableBasicColorCoding);
         setEnableAdvancedColorCoding(currentSettings.enableAdvancedColorCoding);
         // --- Load Palette Config ---
         setWordPaletteConfig({ ...DEFAULT_PALETTE_CONFIG, ...(currentSettings.wordPaletteConfig ?? {}) });
         // --- Load new setting ---
         setShowDeckProgress(currentSettings.showDeckProgress);
         setThemePreference(currentSettings.themePreference); // Load theme preference
         // --------------------------
     }
  }, [settings, settingsLoading, user]);

  // Handlers (Keep original useCallback structure)
  const handleSettingChange = useCallback(async (updates: Partial<Settings>) => {
    if (!user) { toast.error("Authentication Error"); return; }
    try {
        await updateSettings(updates);
        // toast.success("Settings updated"); // Only toast on explicit saves/resets perhaps
    } catch (error) {
        appLogger.error("Failed to save settings:", error);
        toast.error("Error saving settings");
    }
   }, [user, updateSettings]); // Keep dependencies

  // Keep simple handlers wrapped in useCallback
  const handleLanguageChange = useCallback(async (value: string) => { setAppLanguage(value); await handleSettingChange({ appLanguage: value }); }, [handleSettingChange]);
  const handleFontChange = useCallback(async (value: FontOption) => { setCardFont(value); await handleSettingChange({ cardFont: value }); }, [handleSettingChange]);
  const handleMasteryThresholdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value);
      if (!isNaN(value) && value >= 1 && value <= 10) {
          setMasteryThreshold(value);
          handleSettingChange({ masteryThreshold: value });
      } else if (e.target.value === '') {
          setMasteryThreshold(LOCAL_DEFAULT_SETTINGS.masteryThreshold);
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
  
   const handleColorOnlyNonNativeChange = useCallback(async (checked: boolean) => {
    setColorOnlyNonNative(checked);
    await handleSettingChange({ colorOnlyNonNative: checked });
  }, [handleSettingChange]);

  const handleEnableBasicChange = useCallback(async (checked: boolean) => { setEnableBasicColorCoding(checked); await handleSettingChange({ enableBasicColorCoding: checked }); }, [handleSettingChange]);
  const handleEnableAdvancedChange = useCallback(async (checked: boolean) => { setEnableAdvancedColorCoding(checked); await handleSettingChange({ enableAdvancedColorCoding: checked }); }, [handleSettingChange]);

  // --- NEW Palette Change Handler (Replaces handleColorChange, no debounce needed) ---
  const handlePaletteChange = useCallback((pos: string, genderKey: string) => async (selectedPaletteId: string) => {
      setWordPaletteConfig(prevConfig => {
           const currentConfig = prevConfig ?? DEFAULT_PALETTE_CONFIG;
           // Deep copy might be safer if config structure gets complex
           const newConfig = JSON.parse(JSON.stringify(currentConfig));
           if (!newConfig[pos]) newConfig[pos] = {};
           newConfig[pos][genderKey] = selectedPaletteId;
           // Save immediately
           handleSettingChange({ wordPaletteConfig: newConfig });
           return newConfig;
      });
      // Optional feedback toast
      // toast.info(`${pos} (${genderKey}) palette set to ${selectedPaletteId}`);
  }, [handleSettingChange]);
  // ---------------------------------------------------------------------------------

  // --- UPDATED Reset Handler ---
  const handleResetColors = useCallback(async () => {
      const defaultPalettes = { ...DEFAULT_PALETTE_CONFIG };
      setWordPaletteConfig(defaultPalettes); // Reset local state
      await handleSettingChange({ wordPaletteConfig: defaultPalettes }); // Save defaults
      toast.info("Color palette settings reset to default.");
  }, [handleSettingChange]);
  // ---------------------------

  // --- Add handler for new setting ---
  const handleShowDeckProgressChange = useCallback(async (checked: boolean) => {
      setShowDeckProgress(checked);
      await handleSettingChange({ showDeckProgress: checked });
  }, [handleSettingChange]);
  // -----------------------------------

  // --- Updated handler for new theme setting ---
  const handleThemeChange = useCallback(async (value: ThemePreference) => {
      // 1. Update local state
      setThemePreference(value);
      // 2. Apply theme using next-themes
      setTheme(value);
      // 3. Save preference to database
      await handleSettingChange({ themePreference: value });
      // 4. Notify user
      toast.info(`Theme set to ${value}.`);
  }, [handleSettingChange, setTheme]); // Added setTheme to dependencies
  // --------------------------------------

  // Loading/User checks
  if (settingsLoading || authLoading) { return <div className="container mx-auto p-8">Loading Settings...</div>; }
  if (!user) { return <div className="container mx-auto p-8">Redirecting to login...</div>; }

  // --- Render ---
  return (
    <div className="container mx-auto py-8"> {/* Keep Original Container */}
      <div className="flex items-center justify-between mb-8"> {/* Keep Original Header */}
        <h1 className="text-3xl font-bold">Settings</h1>
        <Button variant="outline" onClick={() => router.back()}> <ArrowLeft className="mr-2 h-4 w-4" /> Back </Button>
      </div>
      <div className="grid gap-6"> {/* Keep Original Grid */}

        {/* --- Card Settings Card (Renamed) --- */}
        <Card>
            <CardHeader>
                <CardTitle>Card Settings</CardTitle> {/* Renamed Title */}
                <CardDescription>Configure card appearance and learning behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4">
                    {/* Language */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="appLanguage" className="text-right">Native Language</Label>
                        <Select value={appLanguage} onValueChange={handleLanguageChange}>
                            <SelectTrigger id="appLanguage" className="col-span-3"><SelectValue placeholder="Select language" /></SelectTrigger>
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
                    {/* Font Selection */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="cardFont" className="text-right">Card Font</Label>
                        <Select value={cardFont} onValueChange={handleFontChange}>
                            <SelectTrigger id="cardFont" className="col-span-3"><SelectValue placeholder="Select font" /></SelectTrigger>
                            <SelectContent>
                                {(Object.entries(FONT_OPTIONS) as [FontOption, { name: string; [key: string]: any }][]).map(([key, font]) => (
                                <SelectItem key={key} value={key} style={{ fontFamily: key === 'default' ? 'var(--font-sans)' : key === 'opendyslexic' ? "'OpenDyslexic', system-ui, sans-serif" : "'Atkinson Hyperlegible', system-ui, sans-serif" }} > {font.name} </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {/* Mastery Threshold */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="masteryThreshold" className="text-right">Mastery Threshold</Label>
                        <div className="col-span-3 flex items-center gap-4">
                        <Input id="masteryThreshold" type="number" min={1} max={10} value={masteryThreshold} onChange={handleMasteryThresholdChange} className="w-24" />
                        <span className="text-sm text-muted-foreground">Correct answers needed to master (1-10)</span>
                        </div>
                    </div>
                </div>
                {/* Show Rating Buttons */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                        <h3 className="font-medium">Show Rating Buttons</h3>
                        <p className="text-sm text-muted-foreground">Display Again/Hard/Good/Easy buttons</p>
                    </div>
                    <Switch checked={showDifficulty} onCheckedChange={handleShowDifficultyChange} />
                </div>
            </CardContent>
        </Card>
        {/* --- End Card Settings Card --- */}

        {/* --- Appearance Settings Card (New) --- */}
        <Card>
            <CardHeader>
                <CardTitle>Appearance Settings</CardTitle>
                <CardDescription>Adjust the look and feel of the application</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Theme Preference */}
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="themePreference" className="text-right">Theme</Label>
                    <Select value={themePreference} onValueChange={handleThemeChange}>
                        <SelectTrigger id="themePreference" className="col-span-3">
                            <SelectValue placeholder="Select theme..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="dark">Dark</SelectItem>
                            <SelectItem value="system">System Default</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Separator />
                {/* Show Deck Progress Toggle (Moved) */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-medium">Show Deck Progress</h3>
                        <p className="text-sm text-muted-foreground">Display progress bars on deck cards</p>
                    </div>
                    <Switch checked={showDeckProgress} onCheckedChange={handleShowDeckProgressChange} />
                </div>
            </CardContent>
        </Card>

        {/* --- Speech Settings Card - RESTORED FULL CONTENT --- */}
        <Card>
            <CardHeader>
                <CardTitle>Speech Settings</CardTitle>
                <CardDescription>Configure text-to-speech and language preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* TTS Toggle */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                        <h3 className="font-medium">Text-to-Speech</h3>
                        <p className="text-sm text-muted-foreground">Enable audio playback for cards</p>
                    </div>
                    <Switch checked={ttsEnabled} onCheckedChange={handleTtsEnabledChange}/>
                </div>
                {/* Dialect Selectors */}
                {ttsEnabled && (
                <>
                    <Separator />
                    <div className="grid gap-4 pt-4">
                        {(Object.keys(languageDialects) as Array<keyof typeof languageDialects>).map((langKey) => (
                        <div key={langKey} className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor={`dialect-${langKey}`} className="text-right capitalize">{ { en: 'English', nl: 'Dutch', fr: 'French', de: 'German', es: 'Spanish', it: 'Italian' }[langKey] ?? langKey }</Label>
                            <Select value={languageDialects[langKey] ?? ''} onValueChange={handleDialectChange(langKey)}>
                                <SelectTrigger id={`dialect-${langKey}`} className="col-span-3"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {langKey === 'en' && <> <SelectItem value="en-GB">English (UK)</SelectItem> <SelectItem value="en-US">English (US)</SelectItem> </>}
                                    {langKey === 'nl' && <> <SelectItem value="nl-NL">Dutch (NL)</SelectItem> <SelectItem value="nl-BE">Dutch (BE)</SelectItem> </>}
                                    {langKey === 'fr' && <> <SelectItem value="fr-FR">French (FR)</SelectItem> <SelectItem value="fr-BE">French (BE)</SelectItem> <SelectItem value="fr-CH">French (CH)</SelectItem> </>}
                                    {langKey === 'de' && <> <SelectItem value="de-DE">German (DE)</SelectItem> <SelectItem value="de-AT">German (AT)</SelectItem> <SelectItem value="de-CH">German (CH)</SelectItem> </>}
                                    {langKey === 'es' && <> <SelectItem value="es-ES">Spanish (ES)</SelectItem> </>}
                                    {langKey === 'it' && <> <SelectItem value="it-IT">Italian (IT)</SelectItem> <SelectItem value="it-CH">Italian (CH)</SelectItem> </>}
                                </SelectContent>
                            </Select>
                        </div>
                        ))}
                    </div>
                </>
                )}
            </CardContent>
        </Card>
        {/* --- End Speech Settings Card --- */}

        {/* --- Word Color Coding Card (MODIFIED Content) --- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Word Color Coding</CardTitle>
            <CardDescription>Assign pre-defined color palettes to words based on grammar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
             {/* Section 1: Basic */}
             <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                     <div> <h3 className="font-medium">Basic Color Coding (Nouns & Verbs)</h3> <p className="text-sm text-muted-foreground">Highlight common word types.</p> </div>
                     <Switch checked={enableBasicColorCoding} onCheckedChange={handleEnableBasicChange}/>
                </div>
                {enableBasicColorCoding && (
                    <div className="pl-2 space-y-4">
                        {BASIC_POS.map(pos => (
                            <div key={pos}>
                                <Label className="font-semibold text-base mb-3 block">{pos}</Label>
                                <div className={`grid grid-cols-1 ${pos === 'Noun' ? 'md:grid-cols-3' : 'md:grid-cols-1'} gap-x-6 gap-y-4 items-center`}>
                                    {(pos === 'Noun' ? GENDER_KEYS : ['Default']).map((genderKey, index) => (
                                        <div key={genderKey} className="flex flex-col sm:flex-row sm:items-center gap-2">
                                            <Label htmlFor={`palette-${pos}-${genderKey}`} className="text-sm w-full sm:w-24 text-left sm:text-right flex-shrink-0">
                                                {pos === 'Noun' ? GENDER_OPTIONS_LABELS[index] : 'Default Color'}
                                            </Label>
                                            {/* === Select for Palettes === */}
                                            <Select
                                                value={wordPaletteConfig?.[pos]?.[genderKey] ?? 'default'}
                                                onValueChange={handlePaletteChange(pos, genderKey)}
                                            >
                                                <SelectTrigger id={`palette-${pos}-${genderKey}`} className="flex-grow">
                                                    <SelectValue placeholder="Select palette..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PREDEFINED_PALETTES.map((palette) => (
                                                        <SelectItem key={palette.id} value={palette.id}>
                                                            <div className="flex items-center gap-2">
                                                                <span style={{ backgroundColor: palette.light.background, border: '1px solid #ccc' }} className="inline-block w-4 h-4 rounded-sm flex-shrink-0"></span>
                                                                {palette.name}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {/* ============================ */}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
             </div>

             {/* Section 2: Advanced */}
             <div className="border rounded-lg p-4 space-y-4">
                 <div className="flex items-center justify-between">
                    <div> <h3 className="font-medium">Advanced Color Coding</h3> <p className="text-sm text-muted-foreground">Configure colors for other word types.</p> </div>
                    <Switch checked={enableAdvancedColorCoding} onCheckedChange={handleEnableAdvancedChange}/>
                 </div>
                 {enableAdvancedColorCoding && (
                     <div className="pl-2 space-y-4">
                        {ADVANCED_POS.map(pos => {
                            const isGendered = GENDERED_POS.includes(pos);
                            const relevantGenders = isGendered ? GENDER_KEYS : ['Default'];
                            const relevantLabels = isGendered ? GENDER_OPTIONS_LABELS : ['Neutral / Other'];
                            return (
                                <div key={pos}>
                                    <Label className="font-semibold text-base mb-3 block">{pos}</Label>
                                    <div className={`grid grid-cols-1 ${isGendered ? 'md:grid-cols-3' : 'md:grid-cols-1'} gap-x-6 gap-y-4 items-center`}>
                                        {relevantGenders.map((genderKey, index) => (
                                            <div key={genderKey} className="flex flex-col sm:flex-row sm:items-center gap-2">
                                                <Label htmlFor={`palette-${pos}-${genderKey}`} className="text-sm w-full sm:w-24 text-left sm:text-right flex-shrink-0">
                                                    {relevantLabels[index]}
                                                </Label>
                                                 {/* === Select for Palettes === */}
                                                <Select
                                                    value={wordPaletteConfig?.[pos]?.[genderKey] ?? 'default'}
                                                    onValueChange={handlePaletteChange(pos, genderKey)}
                                                >
                                                    <SelectTrigger id={`palette-${pos}-${genderKey}`} className="flex-grow">
                                                        <SelectValue placeholder="Select palette..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {PREDEFINED_PALETTES.map((palette) => (
                                                            <SelectItem key={palette.id} value={palette.id}>
                                                                 <div className="flex items-center gap-2">
                                                                    <span style={{ backgroundColor: palette.light.background, border: '1px solid #ccc' }} className="inline-block w-4 h-4 rounded-sm flex-shrink-0"></span>
                                                                    {palette.name}
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                 {/* ============================ */}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                     </div>
                 )}
             </div>
                
              {/* Reset Button */}
             <div className="flex justify-end pt-4">
                 <Button variant="outline" size="sm" onClick={handleResetColors}>
                     <RotateCcw className="h-4 w-4 mr-2" />
                     Reset Palette Defaults
                 </Button>
             </div>
             {/* --- NEW Toggle --- */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                              <h3 className="font-medium">Apply Only to Non-Native Language</h3>
                              <p className="text-sm text-muted-foreground">
                                  Only color words not matching your app language ('{settings?.appLanguage || 'N/A'}').
                              </p>
                          </div>
                          <Switch
                              checked={colorOnlyNonNative}
                              onCheckedChange={handleColorOnlyNonNativeChange}
                              aria-labelledby="color-non-native-label"
                          />
                            <span id="color-non-native-label" className="sr-only">Apply color coding only to non-native language words</span>
                      </div>
                      {/* ---------------- */}
          </CardContent>
        </Card>
        {/* --- End Word Color Coding Card --- */}

      </div> {/* End main grid */}
    </div> // End container
  );
}