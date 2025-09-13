// app/edit/[deckId]/DeckMetadataEditor.tsx
"use client";

import { memo } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables, Json } from "@/types/database"; // Make sure Json is imported if needed, though not directly used here

type DbDeck = Tables<'decks'>;

interface DeckMetadataEditorProps {
    name: string;
    // Allow null from the parent state
    primaryLanguage: string | null;
    secondaryLanguage: string | null;
    isBilingual: boolean;
    // The callback expects Partial<Pick<...>> which implies undefined for optional fields
    onChange: (updates: Partial<Pick<DbDeck, 'name' | 'primary_language' | 'secondary_language' | 'is_bilingual'>>) => void;
    isSaving?: boolean;
}

export const DeckMetadataEditor = memo(({
    name,
    primaryLanguage,
    secondaryLanguage,
    isBilingual,
    onChange,
    isSaving
}: DeckMetadataEditorProps) => {

    const handleBilingualChange = (checked: boolean) => {
        // --- FIX: Convert null to undefined when updating ---
        const secondaryUpdate = !checked
            ? { secondary_language: primaryLanguage ?? undefined } // Convert null to undefined
            : {}; // No change to secondary if turning bilingual ON

        onChange({
            is_bilingual: checked,
            ...secondaryUpdate
        });
    };

    const handlePrimaryLangChange = (value: string) => {
        // --- FIX: Convert null to undefined when updating ---
        const secondaryUpdate = !isBilingual
            ? { secondary_language: value ?? undefined } // Update secondary if not bilingual (value won't be null here, but good practice)
            : {};

        onChange({
            primary_language: value ?? undefined, // Ensure primary is also undefined if needed, although Select usually gives string
            ...secondaryUpdate
        });
    };

     const handleSecondaryLangChange = (value: string) => {
         // Secondary change only matters if bilingual is on
         if (isBilingual) {
            onChange({
                secondary_language: value ?? undefined // Convert null to undefined if Select somehow returns it
            });
         }
    };


    return (
        <div className="space-y-6">
            {/* Deck Name Input */}
            <div>
                <Label htmlFor="deckNameInput">Deck Name</Label>
                <div className="relative">
                    <Input
                        id="deckNameInput"
                        value={name}
                        onChange={(e) => onChange({ name: e.target.value })}
                        className="mt-1"
                        placeholder="Enter deck name"
                        disabled={false} // Don't disable input during save
                    />
                    {isSaving && (
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
                            Saving...
                        </div>
                    )}
                </div>
            </div>

            {/* Language Settings Section */}
            <div className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-medium">Bilingual Mode</h3>
                        <p className="text-sm text-muted-foreground">
                            Enable different languages for front and back
                        </p>
                    </div>
                    <Switch
                        checked={isBilingual}
                        onCheckedChange={handleBilingualChange}
                        disabled={false} // Don't disable during save
                    />
                </div>

                {isBilingual ? (
                    <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t">
                        <div>
                            <Label htmlFor="primaryLanguage">Front/Primary Language</Label>
                            <Select
                                value={primaryLanguage ?? undefined} // Pass undefined to Select if null
                                onValueChange={handlePrimaryLangChange}
                                disabled={false} // Don't disable during save
                            >
                                <SelectTrigger id="primaryLanguage"><SelectValue placeholder="Select language" /></SelectTrigger>
                                <SelectContent> <SelectItem value="en">English</SelectItem> <SelectItem value="nl">Dutch</SelectItem> <SelectItem value="fr">French</SelectItem> <SelectItem value="de">German</SelectItem> <SelectItem value="es">Spanish</SelectItem> <SelectItem value="it">Italian</SelectItem> </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="secondaryLanguage">Back/Secondary Language</Label>
                            <Select
                                value={secondaryLanguage ?? undefined} // Pass undefined to Select if null
                                onValueChange={handleSecondaryLangChange} // Use dedicated handler
                                disabled={false} // Don't disable during save
                            >
                                <SelectTrigger id="secondaryLanguage"><SelectValue placeholder="Select language" /></SelectTrigger>
                                <SelectContent> <SelectItem value="en">English</SelectItem> <SelectItem value="nl">Dutch</SelectItem> <SelectItem value="fr">French</SelectItem> <SelectItem value="de">German</SelectItem> <SelectItem value="es">Spanish</SelectItem> <SelectItem value="it">Italian</SelectItem> </SelectContent>
                            </Select>
                        </div>
                    </div>
                ) : (
                    <div className="pt-4 border-t">
                        <Label htmlFor="language">Language</Label>
                        <Select
                            value={primaryLanguage ?? undefined} // Pass undefined to Select if null
                            onValueChange={handlePrimaryLangChange} // This handler updates both if not bilingual
                            disabled={false} // Don't disable during save
                        >
                            <SelectTrigger id="language"><SelectValue placeholder="Select language" /></SelectTrigger>
                            <SelectContent> <SelectItem value="en">English</SelectItem> <SelectItem value="nl">Dutch</SelectItem> <SelectItem value="fr">French</SelectItem> <SelectItem value="de">German</SelectItem> <SelectItem value="es">Spanish</SelectItem> <SelectItem value="it">Italian</SelectItem> </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
        </div>
    );
});

DeckMetadataEditor.displayName = 'DeckMetadataEditor';