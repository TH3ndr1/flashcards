// File: /app/settings/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react"; // Keep imports from working version
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Palette, RotateCcw, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
// --- Adjust imports for Palette ---
import { useSettings, DEFAULT_SETTINGS as PROVIDER_DEFAULT_SETTINGS } from "@/providers/settings-provider";
import type { Settings, FontOption, ThemePreference } from "@/providers/settings-provider"; // Now includes wordPaletteConfig
import { PREDEFINED_PALETTES, DEFAULT_PALETTE_CONFIG } from "@/lib/palettes"; // Import palette data
// import type { Palette as PaletteType } from "@/lib/palettes"; // Import Palette type - unused
// ---------------------------------
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { FONT_OPTIONS } from "@/lib/fonts";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "next-themes"; // Import useTheme
import { appLogger } from '@/lib/logger';
// Debounce likely not needed for Selects, removing for simplicity unless proven necessary
// import { debounce } from "@/lib/utils";

// Constants (Keep all from previous working version)
// const POS_OPTIONS: ReadonlyArray<string> = ['Noun', 'Verb', 'Adjective', 'Adverb', 'Pronoun', 'Preposition', 'Interjection', 'Other'] as const; // unused
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
  const { canAccessSettings, isChildMode } = useFeatureFlags();
  const { setTheme } = useTheme(); // Get setTheme function

  // State initialization (Keep all existing state variables)
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
  // --- State for New PDF Settings ---
  const [enablePdfWordColorCoding, setEnablePdfWordColorCoding] = useState<boolean>(LOCAL_DEFAULT_SETTINGS.enablePdfWordColorCoding);
  const [pdfCardContentFontSize, setPdfCardContentFontSize] = useState<number>(LOCAL_DEFAULT_SETTINGS.pdfCardContentFontSize);
  const [showCardStatusIconsInPdf, setShowCardStatusIconsInPdf] = useState<boolean>(LOCAL_DEFAULT_SETTINGS.showCardStatusIconsInPdf);
  // --------------------------------

  // --- SRS (Study Schedule) Settings ---
  const [defaultEasinessFactor, setDefaultEasinessFactor] = useState<number>(LOCAL_DEFAULT_SETTINGS.defaultEasinessFactor);
  const [minEasinessFactor, setMinEasinessFactor] = useState<number>(LOCAL_DEFAULT_SETTINGS.minEasinessFactor);
  const [graduatingIntervalDays, setGraduatingIntervalDays] = useState<number>(LOCAL_DEFAULT_SETTINGS.graduatingIntervalDays);
  const [easyIntervalDays, setEasyIntervalDays] = useState<number>(LOCAL_DEFAULT_SETTINGS.easyIntervalDays);
  // clearer inputs per step instead of a single comma-separated field
  const [initialStep1, setInitialStep1] = useState<string>(String(LOCAL_DEFAULT_SETTINGS.initialLearningStepsMinutes[0] ?? ''));
  const [initialStep2, setInitialStep2] = useState<string>(String(LOCAL_DEFAULT_SETTINGS.initialLearningStepsMinutes[1] ?? ''));
  const [relearnStep1, setRelearnStep1] = useState<string>(String(LOCAL_DEFAULT_SETTINGS.relearningStepsMinutes[0] ?? ''));
  const [relearnStep2, setRelearnStep2] = useState<string>(String(LOCAL_DEFAULT_SETTINGS.relearningStepsMinutes[1] ?? ''));
  const [firstReviewBaseDays, setFirstReviewBaseDays] = useState<number>(LOCAL_DEFAULT_SETTINGS.firstReviewBaseDays);
  const [earlyReviewMaxDays, setEarlyReviewMaxDays] = useState<number>(LOCAL_DEFAULT_SETTINGS.earlyReviewMaxDays);
  const [learnAgainPenalty, setLearnAgainPenalty] = useState<number>(LOCAL_DEFAULT_SETTINGS.learnAgainPenalty);
  const [learnHardPenalty, setLearnHardPenalty] = useState<number>(LOCAL_DEFAULT_SETTINGS.learnHardPenalty);
  const [lapsedEfPenalty, setLapsedEfPenalty] = useState<number>(LOCAL_DEFAULT_SETTINGS.lapsedEfPenalty);

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
         // --- Load New PDF Settings ---
         setEnablePdfWordColorCoding(currentSettings.enablePdfWordColorCoding);
         setPdfCardContentFontSize(currentSettings.pdfCardContentFontSize);
         setShowCardStatusIconsInPdf(currentSettings.showCardStatusIconsInPdf);
         // --------------------------

         // --- Load SRS settings ---
         setDefaultEasinessFactor(currentSettings.defaultEasinessFactor);
         setMinEasinessFactor(currentSettings.minEasinessFactor);
         setGraduatingIntervalDays(currentSettings.graduatingIntervalDays);
         setEasyIntervalDays(currentSettings.easyIntervalDays);
         const initSteps = currentSettings.initialLearningStepsMinutes || [];
         setInitialStep1(initSteps[0] ? String(initSteps[0]) : '');
         setInitialStep2(initSteps[1] ? String(initSteps[1]) : '');
         const relSteps = currentSettings.relearningStepsMinutes || [];
         setRelearnStep1(relSteps[0] ? String(relSteps[0]) : '');
         setRelearnStep2(relSteps[1] ? String(relSteps[1]) : '');
         setFirstReviewBaseDays(currentSettings.firstReviewBaseDays);
         setEarlyReviewMaxDays(currentSettings.earlyReviewMaxDays);
         setLearnAgainPenalty(currentSettings.learnAgainPenalty);
         setLearnHardPenalty(currentSettings.learnHardPenalty);
         setLapsedEfPenalty(currentSettings.lapsedEfPenalty);
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

  // --- Handlers for New PDF Settings ---
  const handleEnablePdfWordColorCodingChange = useCallback(async (checked: boolean) => {
    setEnablePdfWordColorCoding(checked);
    await handleSettingChange({ enablePdfWordColorCoding: checked });
  }, [handleSettingChange]);

  const handlePdfCardContentFontSizeChange = useCallback(async (value: string) => {
    const numericValue = parseInt(value);
    if (!isNaN(numericValue) && numericValue >= 8 && numericValue <= 28) {
      setPdfCardContentFontSize(numericValue);
      await handleSettingChange({ pdfCardContentFontSize: numericValue });
    }
  }, [handleSettingChange]);

  const handleShowCardStatusIconsInPdfChange = useCallback(async (checked: boolean) => {
    setShowCardStatusIconsInPdf(checked);
    await handleSettingChange({ showCardStatusIconsInPdf: checked });
  }, [handleSettingChange]);

  // const handlePdfCardContentFontSizeBlur = useCallback(async (e: React.FocusEvent<HTMLInputElement>) => {
  //   const value = parseInt(e.target.value);
  //   if (isNaN(value) || value < 6 || value > 24) {
  //     // Reset to default if invalid
  //     setPdfCardContentFontSize(LOCAL_DEFAULT_SETTINGS.pdfCardContentFontSize);
  //     await handleSettingChange({ pdfCardContentFontSize: LOCAL_DEFAULT_SETTINGS.pdfCardContentFontSize });
  //   } else {
  //     // Ensure the valid value is saved
  //     setPdfCardContentFontSize(value);
  //     await handleSettingChange({ pdfCardContentFontSize: value });
  //   }
  // }, [handleSettingChange]); // unused
  // ------------------------------------

  // --- SRS Handlers ---
  const handleDefaultEasinessFactorChange = useCallback(async (value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 1.3 && num <= 3.0) {
      setDefaultEasinessFactor(num);
      await handleSettingChange({ defaultEasinessFactor: num });
    }
  }, [handleSettingChange]);

  const handleMinEasinessFactorChange = useCallback(async (value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 1.0 && num <= 2.5) {
      setMinEasinessFactor(num);
      await handleSettingChange({ minEasinessFactor: num });
    }
  }, [handleSettingChange]);

  const handleGraduatingIntervalDaysChange = useCallback(async (value: string) => {
    const num = parseInt(value);
    if (!isNaN(num) && num >= 1 && num <= 7) {
      setGraduatingIntervalDays(num);
      await handleSettingChange({ graduatingIntervalDays: num });
    }
  }, [handleSettingChange]);

  const handleEasyIntervalDaysChange = useCallback(async (value: string) => {
    const num = parseInt(value);
    if (!isNaN(num) && num >= 1 && num <= 10) {
      setEasyIntervalDays(num);
      await handleSettingChange({ easyIntervalDays: num });
    }
  }, [handleSettingChange]);

  const saveInitialSteps = useCallback(async (s1: string, s2: string) => {
    const arr = [s1, s2]
      .map(v => parseInt(String(v).trim()))
      .filter(n => !isNaN(n) && n > 0);
    await handleSettingChange({ initialLearningStepsMinutes: arr });
  }, [handleSettingChange]);

  const saveRelearnSteps = useCallback(async (s1: string, s2: string) => {
    const arr = [s1, s2]
      .map(v => parseInt(String(v).trim()))
      .filter(n => !isNaN(n) && n > 0);
    await handleSettingChange({ relearningStepsMinutes: arr });
  }, [handleSettingChange]);

  const handleFirstReviewBaseDaysChange = useCallback(async (value: string) => {
    const num = parseInt(value);
    if (!isNaN(num) && num >= 1 && num <= 7) {
      setFirstReviewBaseDays(num);
      await handleSettingChange({ firstReviewBaseDays: num });
    }
  }, [handleSettingChange]);

  const handleEarlyReviewMaxDaysChange = useCallback(async (value: string) => {
    const num = parseInt(value);
    if (!isNaN(num) && num >= 7 && num <= 30) {
      setEarlyReviewMaxDays(num);
      await handleSettingChange({ earlyReviewMaxDays: num });
    }
  }, [handleSettingChange]);

  const handleLearnAgainPenaltyChange = useCallback(async (value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0 && num <= 1) {
      setLearnAgainPenalty(num);
      await handleSettingChange({ learnAgainPenalty: num });
    }
  }, [handleSettingChange]);

  const handleLearnHardPenaltyChange = useCallback(async (value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0 && num <= 1) {
      setLearnHardPenalty(num);
      await handleSettingChange({ learnHardPenalty: num });
    }
  }, [handleSettingChange]);

  const handleLapsedEfPenaltyChange = useCallback(async (value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0 && num <= 1) {
      setLapsedEfPenalty(num);
      await handleSettingChange({ lapsedEfPenalty: num });
    }
  }, [handleSettingChange]);

  // Loading/User checks
  if (settingsLoading || authLoading) { return <div className="container mx-auto p-8">Loading Settings...</div>; }
  if (!user) { return <div className="container mx-auto p-8">Redirecting to login...</div>; }

  // Feature flag protection - Block access if settings are disabled
  if (!canAccessSettings) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
          <div className="w-16 h-16 text-muted-foreground">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-full h-full"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M8 11l2 2 4-4" />
            </svg>
          </div>
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <CardTitle>Settings Access Restricted</CardTitle>
              <CardDescription>
                {isChildMode 
                  ? "Child Mode is active. Settings access is disabled for safety."
                  : "Settings access is currently disabled."
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  {isChildMode 
                    ? "To access settings, please disable Child Mode from your Profile page."
                    : "This feature has been disabled by an administrator."
                  }
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => router.back()}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Go Back
                </Button>
                {isChildMode && (
                  <Button onClick={() => router.push('/profile')}>
                    Go to Profile
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // --- Render ---
  return (
    <div className="container mx-auto py-8"> {/* Keep Original Container */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>
      <Tabs defaultValue="appearance" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
          <TabsTrigger value="appearance" className="text-xs sm:text-sm">Appearance</TabsTrigger>
          <TabsTrigger value="speech" className="text-xs sm:text-sm">Speech</TabsTrigger>
          <TabsTrigger value="color-coding" className="text-xs sm:text-sm">Color Coding</TabsTrigger>
          <TabsTrigger value="pdf" className="text-xs sm:text-sm">PDF</TabsTrigger>
          <TabsTrigger value="srs" className="text-xs sm:text-sm col-span-2 md:col-span-1">Study Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="space-y-6 mt-6">
        {/* --- Card Settings Card (Renamed) --- */}
        <Card>
            <CardHeader>
                <CardTitle>Card Appearance</CardTitle> {/* Renamed Title */}
                <CardDescription>Configure card appearance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4">
                    {/* Font Selection */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="cardFont" className="text-right">Card Font</Label>
                        <Select value={cardFont} onValueChange={handleFontChange}>
                            <SelectTrigger id="cardFont" className="col-span-3"><SelectValue placeholder="Select font" /></SelectTrigger>
                            <SelectContent>
                                {(Object.entries(FONT_OPTIONS) as [FontOption, { name: string; [key: string]: unknown }][]).map(([key, font]) => (
                                <SelectItem key={key} value={key} style={{ fontFamily: key === 'default' ? 'var(--font-sans)' : key === 'opendyslexic' ? "'OpenDyslexic', system-ui, sans-serif" : "'Atkinson Hyperlegible', system-ui, sans-serif" }} > {font.name} </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                <CardTitle>Application Appearance</CardTitle>
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
                        <p className="text-sm text-muted-foreground">Display progress bars during study sessions</p>
                    </div>
                    <Switch checked={showDeckProgress} onCheckedChange={handleShowDeckProgressChange} />
                </div>
            </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="speech" className="space-y-6 mt-6">
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
        </TabsContent>

        <TabsContent value="color-coding" className="space-y-6 mt-6">
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
                                  Only color words not matching your native language ('{settings?.appLanguage || 'N/A'}').
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
        </TabsContent>

        <TabsContent value="pdf" className="space-y-6 mt-6">
        {/* --- New PDF Export Settings Card --- */}
        <Card>
            <CardHeader>
                <CardTitle>PDF Export Settings</CardTitle>
                <CardDescription>Customize how your decks are exported to PDF.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Enable PDF Word Color Coding */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                        <h3 className="font-medium">Enable Word Color Coding in PDF</h3>
                        <p className="text-sm text-muted-foreground">
                            Apply grammatical color coding to words in the generated PDF.
                        </p>
                    </div>
                    <Switch
                        checked={enablePdfWordColorCoding}
                        onCheckedChange={handleEnablePdfWordColorCodingChange}
                        id="enablePdfWordColorCoding"
                    />
                </div>

                {/* PDF Card Content Font Size */}
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="pdfCardContentFontSize" className="text-right col-span-1">
                        PDF Font Size (Q/A)
                    </Label>
                    <div className="col-span-3 flex items-center gap-4">
                        <Select 
                            value={String(pdfCardContentFontSize)} 
                            onValueChange={handlePdfCardContentFontSizeChange}
                        >
                            <SelectTrigger id="pdfCardContentFontSize" className="w-24">
                                <SelectValue placeholder="Select size..." />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: (28 - 8) / 2 + 1 }, (_, i) => 8 + i * 2).map(size => (
                                    <SelectItem key={size} value={String(size)}>{size}pt</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="text-sm text-muted-foreground">
                            Font size for questions and answers in PDF (8-28pt).
                        </span>
                    </div>
                </div>

                {/* Show Card Status Icons in PDF */}
                <Separator />
                <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                        <h3 className="font-medium">Show Card Status Icons</h3>
                        <p className="text-sm text-muted-foreground">
                            Display icons (e.g., 🌱 for New, 🔄 for Relearning) next to questions in the PDF.
                        </p>
                    </div>
                    <Switch
                        checked={showCardStatusIconsInPdf}
                        onCheckedChange={handleShowCardStatusIconsInPdfChange}
                        id="showCardStatusIconsInPdf"
                    />
                </div>

            </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="srs" className="space-y-6 mt-6">
        {/* --- SRS Settings (Kid-friendly explanations) --- */}
        <Card>
          <CardHeader>
            <CardTitle>Study Schedule (SRS) Settings</CardTitle>
            <CardDescription>These settings control when cards come back for practice. The numbers should feel friendly and not too long.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Explanation paragraph */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-4">
              <p className="text-sm leading-relaxed">
                <strong>What is SRS?</strong> SRS stands for "Spaced Repetition System" - a smart way to help you remember things better. 
                When you answer a card correctly, it waits longer before showing up again. When you get it wrong, it comes back sooner. 
                This helps your brain remember things for a long time without wasting time on cards you already know well.
                <br /><br />
                The settings below follow the life cycle of a flashcard: learning → first review → normal growth → forgetting → corrections. 
                Smaller numbers mean cards come back sooner (more practice), while bigger numbers mean longer waits (less practice).
              </p>
              
              {/* SRS Flow Diagram */}
              <div className="flex justify-center">
                <svg 
                  viewBox="0 0 400 280" 
                  className="w-full max-w-md h-auto"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Background */}
                  <rect width="400" height="280" fill="transparent" />
                  
                  {/* Learning Box */}
                  <rect x="20" y="20" width="100" height="60" rx="8" 
                    fill="hsl(var(--primary))" fillOpacity="0.1" 
                    stroke="hsl(var(--primary))" strokeWidth="2"/>
                  <text x="70" y="40" textAnchor="middle" className="fill-foreground text-xs font-medium">
                    Learning
                  </text>
                  <text x="70" y="55" textAnchor="middle" className="fill-muted-foreground text-xs">
                    New Card
                  </text>
                  <text x="70" y="68" textAnchor="middle" className="fill-muted-foreground text-xs">
                    1min → 10min
                  </text>
                  
                  {/* Arrow 1: Learning to First Review */}
                  <path d="M 130 50 L 150 50" stroke="hsl(var(--foreground))" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                  <text x="140" y="45" textAnchor="middle" className="fill-muted-foreground text-xs">✓</text>
                  
                  {/* First Review Box */}
                  <rect x="160" y="20" width="100" height="60" rx="8" 
                    fill="hsl(var(--secondary))" fillOpacity="0.1" 
                    stroke="hsl(var(--secondary))" strokeWidth="2"/>
                  <text x="210" y="40" textAnchor="middle" className="fill-foreground text-xs font-medium">
                    First Review
                  </text>
                  <text x="210" y="55" textAnchor="middle" className="fill-muted-foreground text-xs">
                    After 1 day
                  </text>
                  
                  {/* Arrow 2: First Review to Normal Reviews */}
                  <path d="M 270 50 L 290 50" stroke="hsl(var(--foreground))" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                  <text x="280" y="45" textAnchor="middle" className="fill-muted-foreground text-xs">✓</text>
                  
                  {/* Normal Reviews Box */}
                  <rect x="300" y="20" width="80" height="60" rx="8" 
                    fill="hsl(var(--accent))" fillOpacity="0.1" 
                    stroke="hsl(var(--accent))" strokeWidth="2"/>
                  <text x="340" y="40" textAnchor="middle" className="fill-foreground text-xs font-medium">
                    Normal
                  </text>
                  <text x="340" y="52" textAnchor="middle" className="fill-foreground text-xs font-medium">
                    Reviews
                  </text>
                  <text x="340" y="68" textAnchor="middle" className="fill-muted-foreground text-xs">
                    Growing gaps
                  </text>
                  
                  {/* Curved arrow back to Relearning */}
                  <path d="M 340 90 Q 340 140 340 180 Q 340 200 320 200 L 120 200 Q 100 200 100 180 L 100 160" 
                    stroke="hsl(var(--destructive))" strokeWidth="2" fill="none" markerEnd="url(#arrowhead-red)"/>
                  <text x="220" y="215" textAnchor="middle" className="fill-destructive text-xs">✗ Forgot</text>
                  
                  {/* Relearning Box */}
                  <rect x="50" y="120" width="100" height="60" rx="8" 
                    fill="hsl(var(--destructive))" fillOpacity="0.1" 
                    stroke="hsl(var(--destructive))" strokeWidth="2"/>
                  <text x="100" y="140" textAnchor="middle" className="fill-foreground text-xs font-medium">
                    Relearning
                  </text>
                  <text x="100" y="155" textAnchor="middle" className="fill-muted-foreground text-xs">
                    Forgotten Card
                  </text>
                  <text x="100" y="168" textAnchor="middle" className="fill-muted-foreground text-xs">
                    10min → 1 day
                  </text>
                  
                  {/* Arrow from Relearning back to Normal Reviews */}
                  <path d="M 160 150 Q 200 150 240 150 Q 280 150 300 120 Q 320 100 340 90" 
                    stroke="hsl(var(--foreground))" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)"/>
                  <text x="230" y="145" textAnchor="middle" className="fill-muted-foreground text-xs">✓ Relearned</text>
                  
                  {/* Arrow definitions */}
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" 
                      refX="9" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--foreground))" />
                    </marker>
                    <marker id="arrowhead-red" markerWidth="10" markerHeight="7" 
                      refX="9" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--destructive))" />
                    </marker>
                  </defs>
                  
                  {/* Legend */}
                  <text x="200" y="260" textAnchor="middle" className="fill-muted-foreground text-xs">
                    ✓ = Correct Answer  •  ✗ = Forgot Answer
                  </text>
                </svg>
              </div>
            </div>

            {/* 1. Learning New Cards */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">1.</span>
                <h3 className="text-lg font-semibold">Learning New Cards</h3>
              </div>
              
              <div className="space-y-3">
                <Label>Learning Steps (minutes)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Step 1:</span>
                  <Input 
                    className="w-20" 
                    value={initialStep1} 
                    onChange={(e) => {
                      setInitialStep1(e.target.value);
                      saveInitialSteps(e.target.value, initialStep2);
                    }} 
                  />
                  <span className="text-sm">Step 2:</span>
                  <Input 
                    className="w-20" 
                    value={initialStep2} 
                    onChange={(e) => {
                      setInitialStep2(e.target.value);
                      saveInitialSteps(initialStep1, e.target.value);
                    }} 
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
                <p className="text-sm text-muted-foreground pl-4">
                  When learning a brand new card, these are the waiting times between repetitions. 
                  <br></br><strong>Step 1:</strong> How long to wait after seeing the card for the first time. 
                  <br></br><strong>Step 2:</strong> How long to wait after getting Step 1 right. 
                  Example: "1, 10" = see again in 1 minute, then 10 minutes if both are correct.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <Label className="font-medium sm:w-32 sm:text-right sm:flex-shrink-0">"Easy" Shortcut</Label>
                <div className="flex items-center gap-2">
                  <Select value={String(easyIntervalDays)} onValueChange={handleEasyIntervalDaysChange}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[2,3,4,5].map(v => (
                        <SelectItem key={v} value={String(v)}>{v} days</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-sm text-muted-foreground">
                  When you press "Easy" during learning (card felt super simple), 
                  skip the normal learning steps and wait this many days instead.
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <Label className="font-medium sm:w-32 sm:text-right sm:flex-shrink-0">Mastery Threshold</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    min={1} 
                    max={10} 
                    value={masteryThreshold} 
                    onChange={handleMasteryThresholdChange} 
                    className="w-16" 
                  />
                  <span className="text-sm text-muted-foreground sm:hidden">answers</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  How many correct answers in a row are needed to consider a card "mastered" and move it to long-term memory. 
                  Higher numbers mean more certainty but slower progress.
                </span>
              </div>
            </div>

            <Separator />

            {/* 2. First Review */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">2.</span>
                <h3 className="text-lg font-semibold">First Review</h3>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <Label className="font-medium sm:w-32 sm:text-right sm:flex-shrink-0">First Day After Learning</Label>
                <div className="flex items-center gap-2">
                  <Select value={String(graduatingIntervalDays)} onValueChange={handleGraduatingIntervalDaysChange}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5,6,7].map(v => (
                        <SelectItem key={v} value={String(v)}>{v} day{v>1?'s':''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-sm text-muted-foreground">
                  After completing all learning steps successfully, how many days until the first "real" review?
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <Label className="font-medium sm:w-32 sm:text-right sm:flex-shrink-0">First Review Base</Label>
                <div className="flex items-center gap-2">
                  <Select value={String(firstReviewBaseDays)} onValueChange={handleFirstReviewBaseDaysChange}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[3,4,5,6].map(v => (
                        <SelectItem key={v} value={String(v)}>{v} days</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-sm text-muted-foreground">
                  Base number of days for calculating the first review interval. 
                  Gets multiplied by the "ease" factor to determine actual waiting time.
                </span>
              </div>
            </div>

            <Separator />

            {/* 3. Normal Reviews */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">3.</span>
                <h3 className="text-lg font-semibold">Normal Reviews</h3>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <Label className="font-medium sm:w-32 sm:text-right sm:flex-shrink-0">Default Ease</Label>
                <div className="flex items-center gap-2">
                  <Select value={String(defaultEasinessFactor)} onValueChange={handleDefaultEasinessFactorChange}>
                    <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[2.0, 2.1, 2.2, 2.3, 2.4, 2.5].map(v => (
                        <SelectItem key={v} value={String(v)}>{v.toFixed(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-sm text-muted-foreground">
                  How much the waiting time grows each time you get a card right. 
                  If set to 2.3, you'll wait 2.3 times longer than the previous interval. 
                  Lower = more frequent reviews, higher = longer gaps between reviews.
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <Label className="font-medium sm:w-32 sm:text-right sm:flex-shrink-0">Minimum Ease</Label>
                <div className="flex items-center gap-2">
                  <Select value={String(minEasinessFactor)} onValueChange={handleMinEasinessFactorChange}>
                    <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1.3, 1.4, 1.5, 1.6, 1.7].map(v => (
                        <SelectItem key={v} value={String(v)}>{v.toFixed(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-sm text-muted-foreground">
                  The lowest the ease factor can drop. Even if you get a card wrong repeatedly, 
                  it won't grow slower than this rate. Prevents cards from getting stuck with very short intervals.
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <Label className="font-medium sm:w-32 sm:text-right sm:flex-shrink-0">Early Max Wait</Label>
                <div className="flex items-center gap-2">
                  <Select value={String(earlyReviewMaxDays)} onValueChange={handleEarlyReviewMaxDaysChange}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[10,12,14,16,21].map(v => (
                        <SelectItem key={v} value={String(v)}>{v} days</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-sm text-muted-foreground">
                  During the first few reviews, never wait longer than this many days. 
                  Prevents new cards from disappearing for weeks while you're still learning them.
                </span>
              </div>
            </div>

            <Separator />

            {/* 4. Forgotten Cards (Relearning) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">4.</span>
                <h3 className="text-lg font-semibold">Forgotten Cards (Relearning)</h3>
              </div>

              <div className="space-y-3">
                <Label>Relearning Steps (minutes)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Step 1:</span>
                  <Input 
                    className="w-20" 
                    value={relearnStep1} 
                    onChange={(e) => {
                      setRelearnStep1(e.target.value);
                      saveRelearnSteps(e.target.value, relearnStep2);
                    }} 
                  />
                  <span className="text-sm">Step 2:</span>
                  <Input 
                    className="w-20" 
                    value={relearnStep2} 
                    onChange={(e) => {
                      setRelearnStep2(e.target.value);
                      saveRelearnSteps(relearnStep1, e.target.value);
                    }} 
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
                <p className="text-sm text-muted-foreground pl-4">
                  When you completely forget a card you knew before, it enters "relearning" mode. 
                  <strong>Step 1:</strong> Quick review (usually 10 minutes). 
                  <strong>Step 2:</strong> Longer wait to make sure it stuck (usually 1440 minutes = 1 day). 
                  After both steps, the card returns to normal review schedule.
                </p>
              </div>
            </div>

            <Separator />

            {/* 5. Corrections and Penalties */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">5.</span>
                <h3 className="text-lg font-semibold">Corrections and Penalties</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <Label className="w-20 text-right flex-shrink-0 text-xs">Again Penalty</Label>
                  <Select value={String(learnAgainPenalty)} onValueChange={handleLearnAgainPenaltyChange}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0.1, 0.15, 0.2, 0.25].map(v => (
                        <SelectItem key={v} value={String(v)}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">
                    When you press "Again" (completely forgot), this amount gets subtracted from the ease factor 
                    to make future reviews come sooner.
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="w-20 text-right flex-shrink-0 text-xs">Hard Penalty</Label>
                  <Select value={String(learnHardPenalty)} onValueChange={handleLearnHardPenaltyChange}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0.03, 0.05, 0.07].map(v => (
                        <SelectItem key={v} value={String(v)}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">
                    When you press "Hard" (struggled but got it), this small amount gets subtracted from the ease factor.
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="w-20 text-right flex-shrink-0 text-xs">Lapse Penalty</Label>
                  <Select value={String(lapsedEfPenalty)} onValueChange={handleLapsedEfPenaltyChange}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0.15, 0.2, 0.25].map(v => (
                        <SelectItem key={v} value={String(v)}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">
                    When you forget a card you knew well before, this amount gets subtracted from the ease factor permanently.
                  </span>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>
        </TabsContent>

      </Tabs>
    </div> // End container
  );
}