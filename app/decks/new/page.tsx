// app/decks/new/page.tsx
"use client";

import type React from "react"; // Import React type if needed for specific typings
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSettings } from "@/providers/settings-provider"; // To get default language
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Loader2 as IconLoader } from "lucide-react"; // For loading state

/**
 * Page component for manually creating a new deck's metadata.
 * Collects name, language(s), and bilingual status, then calls the API
 * to create the deck shell before redirecting to the edit page.
 */
export default function NewDeckPage() {
    const router = useRouter();
    const { settings } = useSettings();

    // State for form inputs
    const [name, setName] = useState("");
    const [isBilingual, setIsBilingual] = useState(false);
    const [primaryLanguage, setPrimaryLanguage] = useState(""); // Renamed for clarity
    const [secondaryLanguage, setSecondaryLanguage] = useState(""); // Renamed for clarity
    const [loading, setLoading] = useState(false);

    // Set default languages based on user settings when component mounts
    useEffect(() => {
        if (settings?.appLanguage) {
            console.log("[NewDeckPage] Setting default language from settings:", settings.appLanguage);
            setPrimaryLanguage(settings.appLanguage);
            setSecondaryLanguage(settings.appLanguage); // Default secondary to same as primary
        } else {
            // Fallback if settings not loaded or no language set
             console.log("[NewDeckPage] No default language in settings, using 'en'.");
             setPrimaryLanguage("en");
             setSecondaryLanguage("en");
        }
    }, [settings]); // Re-run if settings change

    // Handler for language change when NOT bilingual
    const handleSingleLanguageChange = (value: string) => {
        setPrimaryLanguage(value);
        setSecondaryLanguage(value); // Keep them synced
    };

    // Form submission handler
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); // Prevent default form submission

        // Basic Validation
        if (!name.trim()) {
            toast.error("Deck name is required.");
            return;
        }
        if (!primaryLanguage) {
            toast.error("Primary language is required.");
            return;
        }
        if (isBilingual && !secondaryLanguage) {
             toast.error("Secondary language is required for bilingual decks.");
             return;
        }

        setLoading(true); // Indicate loading state
        const toastId = toast.loading("Creating deck...");

        // Prepare the payload for the API
        const payload = {
            name: name.trim(),
            questionLanguage: primaryLanguage, // Map state to API expected field name
            answerLanguage: isBilingual ? secondaryLanguage : primaryLanguage, // Use primary if not bilingual
            isBilingual: isBilingual,
            flashcards: [] // Send empty array for manual creation
        };

        console.log("[NewDeckPage] Sending payload to POST /api/decks:", payload);

        try {
            const response = await fetch('/api/decks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                // Handle API errors (like validation errors, auth errors, db errors)
                throw new Error(result.message || `HTTP error! status: ${response.status}`);
            }

            // Success!
            toast.success(`Deck "${payload.name}" created! Redirecting...`, { id: toastId });
            console.log("[NewDeckPage] Deck created successfully, API response:", result);

            // Redirect to the edit page for the new deck
            if (result.deckId) {
                router.push(`/edit/${result.deckId}`);
            } else {
                 // Should not happen if API returns correctly, but handle defensively
                 throw new Error("API succeeded but did not return a deck ID.");
            }

        } catch (error: any) {
            console.error("[NewDeckPage] Error creating deck:", error);
            toast.error("Failed to create deck", {
                id: toastId,
                description: error.message || "An unexpected error occurred.",
            });
            setLoading(false); // Stop loading on error
        }
        // No finally block needed for setLoading(false) because we navigate away on success
    };

    return (
        <div className="container mx-auto max-w-2xl px-4 py-8">
             <Button variant="outline" size="sm" onClick={() => router.back()} className="mb-4">
                 <ArrowLeft className="mr-2 h-4 w-4" />
                 Back
            </Button>

            <Card>
                <form onSubmit={handleSubmit}>
                    <CardHeader>
                        <CardTitle>Create New Deck</CardTitle>
                        <CardDescription>Enter the basic details for your new deck. You can add cards on the next screen.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6">
                        {/* Deck Name */}
                        <div className="grid gap-2">
                            <Label htmlFor="name">Deck Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., French Vocabulary Chapter 1"
                                required
                                disabled={loading}
                            />
                        </div>

                        {/* Bilingual Switch */}
                        <div className="flex items-center space-x-2 rounded-lg border p-4">
                             <Switch
                                id="bilingual"
                                checked={isBilingual}
                                onCheckedChange={setIsBilingual}
                                disabled={loading}
                            />
                            <div className="flex-1">
                                <Label htmlFor="bilingual" className="font-medium">
                                    Bilingual Deck
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Use different languages for questions (front) and answers (back).
                                </p>
                            </div>
                        </div>

                        {/* Language Selects */}
                        {isBilingual ? (
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="primaryLanguage">Question Language (Front)</Label>
                                    <Select value={primaryLanguage} onValueChange={setPrimaryLanguage} required disabled={loading}>
                                        <SelectTrigger id="primaryLanguage">
                                            <SelectValue placeholder="Select language..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="en">English</SelectItem>
                                            <SelectItem value="nl">Dutch</SelectItem>
                                            <SelectItem value="fr">French</SelectItem>
                                            <SelectItem value="de">German</SelectItem>
                                            <SelectItem value="es">Spanish</SelectItem>
                                            <SelectItem value="it">Italian</SelectItem>
                                            {/* Add more languages as needed */}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="secondaryLanguage">Answer Language (Back)</Label>
                                    <Select value={secondaryLanguage} onValueChange={setSecondaryLanguage} required disabled={loading}>
                                        <SelectTrigger id="secondaryLanguage">
                                            <SelectValue placeholder="Select language..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="en">English</SelectItem>
                                            <SelectItem value="nl">Dutch</SelectItem>
                                            <SelectItem value="fr">French</SelectItem>
                                            <SelectItem value="de">German</SelectItem>
                                            <SelectItem value="es">Spanish</SelectItem>
                                            <SelectItem value="it">Italian</SelectItem>
                                            {/* Add more languages as needed */}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                <Label htmlFor="language">Deck Language</Label>
                                <Select value={primaryLanguage} onValueChange={handleSingleLanguageChange} required disabled={loading}>
                                    <SelectTrigger id="language">
                                        <SelectValue placeholder="Select language..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="en">English</SelectItem>
                                        <SelectItem value="nl">Dutch</SelectItem>
                                        <SelectItem value="fr">French</SelectItem>
                                        <SelectItem value="de">German</SelectItem>
                                        <SelectItem value="es">Spanish</SelectItem>
                                        <SelectItem value="it">Italian</SelectItem>
                                        {/* Add more languages as needed */}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={loading} className="w-full">
                            {loading ? <IconLoader className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {loading ? "Creating..." : "Create Deck & Add Cards"}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}