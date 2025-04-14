"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Plus, Save, Trash2, Loader2 as IconLoader } from "lucide-react"
import Link from "next/link"
import { CardEditor } from "@/components/card-editor"
// import { TableEditor } from "@/components/table-editor" // Comment out until refactored
import { useDecks } from "@/hooks/use-decks"
import type { Tables } from "@/types/database" // Import Tables
import type { UpdateDeckParams } from "@/hooks/use-decks"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Terminal } from "lucide-react"
import { createCard as createCardAction, updateCard as updateCardAction } from "@/lib/actions/cardActions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

// Define types using Tables
type DbDeck = Tables<'decks'>;
type DbCard = Tables<'cards'>;

/**
 * Edit Deck Page Component.
 *
 * This page allows users to edit an existing deck, including its name
 * and associated flashcards. It fetches the deck data based on the `deckId`
 * route parameter, provides UI for modifications (using `TableEditor` and
 * `CardEditor`), and handles saving changes or deleting the deck using the
 * `useDecks` hook.
 *
 * Features:
 * - Fetches deck data on load.
 * - Displays loading states and error messages.
 * - Allows editing deck name.
 * - Allows adding, updating, and deleting cards within the deck.
 * - Persists changes via `updateDeck`.
 * - Allows deleting the entire deck via `deleteDeck`.
 * - Provides user feedback through toasts.
 *
 * @returns {JSX.Element} The UI for editing a deck, or loading/error states.
 */

// Define state type: DbDeck combined with potentially partial cards
type DeckEditState = (DbDeck & { cards: Array<Partial<DbCard>> }) | null;

export default function EditDeckPage() {
  const params = useParams<{ deckId: string }>()
  const deckId = params?.deckId
  const router = useRouter()
  const { getDeck, updateDeck, deleteDeck, loading: useDecksLoading } = useDecks()
  
  const [deck, setDeck] = useState<DeckEditState>(null)
  const [activeTab, setActiveTab] = useState("cards")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refetch function
  const refetchDeck = useCallback(async () => {
      if (!deckId) return;
      console.log("[EditDeckPage] Refetching deck:", deckId);
      setLoading(true);
       try {
            const result = await getDeck(deckId);
            if (result.error) throw result.error;
            if (result.data) {
                const fetchedDeck = result.data;
                // Ensure cards are typed correctly
                setDeck({ ...fetchedDeck, cards: fetchedDeck.cards as Array<Partial<DbCard>> });
            } else {
                throw new Error("Deck not found after refetch.");
            }
            setError(null);
       } catch(e: any) {
            console.error("Error refetching deck:", e);
            setError(e.message || "Failed to refresh deck data.");
            setDeck(null); 
       } finally {
           setLoading(false);
       }
  }, [deckId, getDeck]);

  // Initial Load Effect
  useEffect(() => {
    let isMounted = true; 
    const loadDeck = async () => {
      if (useDecksLoading || !deckId) return; 
        
      console.log("EditDeckPage: Loading deck with ID:", deckId);
      if (isMounted) { setLoading(true); setError(null); }

      try {
          const result = await getDeck(deckId); 
          if (!isMounted) return;

          if (result.error) {
              throw result.error;
          } else if (result.data) {
              const fetchedDeck = result.data;
              // Correctly set state matching DeckEditState
              setDeck({ 
                  ...fetchedDeck, 
                  cards: fetchedDeck.cards as Array<Partial<DbCard>> // Ensure cards are typed
              }); 
              setError(null);
          } else {
               throw new Error("Deck not found");
          }
      } catch (err: any) {
          console.error("Error loading deck:", err);
           if (isMounted) setError(err.message || "Failed to load deck.");
           if (isMounted) setDeck(null); 
      } finally {
          if (isMounted) setLoading(false);
      }
    };
    loadDeck();
    return () => { isMounted = false; };
  }, [deckId, getDeck, useDecksLoading]); 

  const handleNameChange = (newName: string) => {
    if (!deck) return
    // Use name (ensure DbDeck interface uses name)
    setDeck({ ...deck, name: newName });
  }

  // handleSave needs careful review of updateDeck's expected payload
  const handleSave = async () => {
    if (!deck) return
    setSaving(true)
    try {
        // Prepare the payload matching UpdateDeckParams (excluding id and description)
        const updatePayload: UpdateDeckParams = {
            name: deck.name,
            primary_language: deck.primary_language, 
            secondary_language: deck.secondary_language,
            is_bilingual: deck.is_bilingual,
            // Add any other DbDeck fields allowed in UpdateDeckParams
        };
        
        // Call updateDeck with id and the payload
        const result = await updateDeck(deck.id, updatePayload); 

      if (result.error) {
        throw result.error;
      } else {
        toast.success("Changes saved successfully!");
        // Optionally refetch or just rely on optimistic update/navigation
        router.push("/"); 
      }
    } catch (error: any) {
      console.error("Error saving deck:", error);
      toast.error("Error saving changes", { description: error.message || "Unknown error" });
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteDeck = async () => {
    if (!deck) return
    // Confirmation is handled by AlertDialog now
    setIsDeleting(true);
    const deckName = deck.name;
    try {
      const result = await deleteDeck(deck.id)
      if (result.error) {
        throw result.error;
      } else {
        toast.success(`Deck "${deckName}" deleted successfully!`);
        router.push("/"); // Navigate away
      }
    } catch (error: any) {
      console.error("Error deleting deck:", error);
      toast.error(`Error deleting deck "${deckName}"`, { description: error.message || "Unknown error" });
      setIsDeleting(false); // Reset deleting state on error
    }
    // No finally needed here as we navigate away on success
  }

  const handleAddCard = () => {
    if (deck) {
      const newCard: Partial<DbCard> = {
        question: "",
        answer: "",
        deck_id: deck.id,
        user_id: deck.user_id,
        srs_level: 0,
        easiness_factor: 2.5,
        interval_days: 0,
        last_reviewed_at: null,
        next_review_due: null,
        last_review_grade: null,
        correct_count: 0,
        incorrect_count: 0,
      };
      // Add type to prev
      setDeck((prev: DeckEditState | null) => prev ? { ...prev, cards: [...prev.cards, newCard] } : null);
    }
  }

  const handleCreateCard = async (question: string, answer: string): Promise<string | null> => {
      if (!deck) {
          toast.error("Cannot create card: Deck data missing.");
          return null;
      }
      console.log("Parent: Calling createCardAction...", { deckId: deck.id, question, answer });
      toast.info("Saving new card...");

      try {
          const result = await createCardAction(deck.id, { 
              question: question,
              answer: answer 
          });
          
          if (result.error || !result.data) {
              throw result.error || new Error("Failed to create card (no data returned).");
          } 
          
          toast.success(`New card created successfully!`);
          
          await refetchDeck(); 
          
          return result.data.id;

      } catch (error: any) {
          console.error("Error creating card:", error);
          toast.error("Failed to save new card", { description: error.message || "An unknown error occurred." });
          return null;
      }
  };

  const handleUpdateCard = useCallback(async (cardId: string, question: string, answer: string) => {
    console.log(`[EditDeckPage] Debounced Update for Card ID: ${cardId}`);
    
    // Prepare payload for the action
    const updatePayload: { question?: string, answer?: string } = {};
    let changed = false;

    // Find the original card state to compare
    // Add type to c
    const originalCard = deck?.cards.find((c: Partial<DbCard>) => c.id === cardId);

    if (originalCard?.question !== question) {
        updatePayload.question = question;
        changed = true;
    }
    if (originalCard?.answer !== answer) {
        updatePayload.answer = answer;
        changed = true;
    }

    // Only call action if something actually changed
    if (!changed) {
        console.log(`[EditDeckPage] No changes detected for card ${cardId}, skipping update.`);
        return;
    }
    
    // Update local state optimistically *before* calling action (optional)
    // setDeck(prevDeck => { ... update card in prevDeck ... }); 
    // toast.info(`Saving changes for card...`, { id: `update-${cardId}` }); // Optional loading toast

    try {
        console.log(`[EditDeckPage] Calling updateCardAction for ${cardId} with payload:`, updatePayload);
        const result = await updateCardAction(cardId, updatePayload);
        if (result.error) {
            // Use result.error directly as it's a string
            toast.error(`Failed to update card`, { id: `update-${cardId}`, description: result.error });
            // TODO: Optionally revert optimistic update here
            // await refetchDeck(); // Or refetch on error
        } else {
            // toast.success(`Card changes saved!`, { id: `update-${cardId}` }); // Success feedback
            // Update local state with the confirmed data from the server
             // Add type to prevDeck and c
             setDeck((prevDeck: DeckEditState | null) => {
                 if (!prevDeck) return null;
                 return {
                     ...prevDeck,
                     cards: prevDeck.cards.map((c: Partial<DbCard>) => c.id === cardId ? result.data : c) as Array<Partial<DbCard>>
                 };
            });
        }
    } catch (error: any) {
         toast.error(`Failed to update card`, { id: `update-${cardId}`, description: error.message || "Unknown error" });
         // TODO: Optionally revert optimistic update here or refetch
    }
  }, [deck]); // Depend on deck state to access originalCard

  const handleDeleteCard = (cardId: string) => {
    if (deck) {
      // Add type to prevDeck and card
      setDeck((prevDeck: DeckEditState | null) => {
          if (!prevDeck) return null;
          return {
              ...prevDeck,
              cards: prevDeck.cards.filter((card: Partial<DbCard>) => card.id !== cardId)
          };
      });
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center">
          <h2 className="text-xl font-semibold text-red-500 mb-4">Error Loading Deck</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => router.push("/")}>Return to Home</Button>
        </div>
      </div>
    )
  }

  if (!deck) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center">
          <h2 className="text-xl font-semibold mb-4">Deck Not Found</h2>
          <p className="text-muted-foreground mb-6">The deck you're looking for doesn't exist or couldn't be loaded.</p>
          <Button onClick={() => router.push("/")}>Return to Home</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="py-4 px-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-y-2">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Link href="/" className="mr-0" aria-label="Back to Decks">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <Input
            value={deck.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="text-2xl font-bold h-auto py-1 px-2 border-input flex-1 min-w-0"
            placeholder="Deck name"
          />
        </div>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <h3 className="font-medium">Bilingual Mode</h3>
            <p className="text-sm text-muted-foreground">
              Enable different languages for front and back
            </p>
          </div>
          <Switch
            checked={deck.is_bilingual ?? false}
            onCheckedChange={(checked) =>
              // Add type to prev
              setDeck((prev: DeckEditState | null) => prev ? {
                ...prev,
                is_bilingual: checked,
                // When switching to monolingual, copy primary to secondary
                secondary_language: checked ? prev.secondary_language : prev.primary_language,
              } : null)
            }
          />
        </div>

        {deck.is_bilingual ? (
          <div className="grid gap-4 p-4 border rounded-lg sm:grid-cols-2">
            <div>
              <Label htmlFor="primaryLanguage">Front/Primary Language</Label>
              <Select
                value={deck.primary_language ?? undefined}
                // Add type to value and prev
                onValueChange={(value: string) => setDeck((prev: DeckEditState | null) => prev ? { ...prev, primary_language: value } : null) }
              >
                <SelectTrigger id="primaryLanguage">
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
            <div>
              <Label htmlFor="secondaryLanguage">Back/Secondary Language</Label>
              <Select
                 value={deck.secondary_language ?? undefined}
                 // Add type to value and prev
                 onValueChange={(value: string) => setDeck((prev: DeckEditState | null) => prev ? { ...prev, secondary_language: value } : null) }
              >
                <SelectTrigger id="secondaryLanguage">
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
        ) : (
          <div className="p-4 border rounded-lg">
            <Label htmlFor="language">Language</Label>
            <Select
              value={deck.primary_language ?? undefined}
              // Add type to value and prev
              onValueChange={(value: string) =>
                setDeck((prev: DeckEditState | null) => prev ? {
                  ...prev,
                  primary_language: value,
                  secondary_language: value,
                } : null)
              }
            >
              <SelectTrigger id="language">
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
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="cards">Card View</TabsTrigger>
          <TabsTrigger value="table">Table View</TabsTrigger>
        </TabsList>
        <TabsContent value="cards" className="mt-6">
          {deck.cards.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-6 h-40">
                <p className="text-muted-foreground text-center mb-4">No cards in this deck yet</p>
                <Button onClick={handleAddCard}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Card
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {deck.cards.map((cardData: Partial<DbCard>, index: number) => (
                <CardEditor
                  key={cardData.id || `new-${index}`}
                  card={cardData}
                  onUpdate={handleUpdateCard}
                  onDelete={handleDeleteCard}
                  onCreate={!cardData.id ? handleCreateCard : undefined}
                />
              ))}
            </div>
          )}
          
          {deck.cards.length > 0 && (
             <div className="flex justify-center mt-6">
               <Button onClick={handleAddCard}>
                 <Plus className="mr-2 h-4 w-4" />
                 Add Card
               </Button>
             </div>
          )}
        </TabsContent>
        <TabsContent value="table" className="mt-6">
           {/* Commented out TableEditor until it's refactored */}
           {/* <TableEditor
            cards={deck.cards}
            onUpdate={handleUpdateCard}
            onDelete={handleDeleteCard}
            onAdd={handleAddCard}
          /> */}
          <p className="text-center text-muted-foreground">Table Editor view needs refactoring.</p>
        </TabsContent>
      </Tabs>
      
      <div className="flex justify-end mt-8"> 
          <Button onClick={handleSave} disabled={saving || isDeleting}>
            {saving ? <IconLoader className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? "Updating..." : "Update Deck"}
          </Button>
       </div>
      
      <div className="mt-8 pt-6 border-t border-dashed border-destructive/50">
        <h3 className="text-lg font-semibold text-destructive mb-2">Danger Zone</h3>
        <p className="text-sm text-muted-foreground mb-4">Deleting this deck and all its cards cannot be undone.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isDeleting || saving}>
               <Trash2 className="mr-2 h-4 w-4" /> Delete Deck
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Delete "{deck.name}"?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone. This will permanently delete the deck and all associated cards.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
               <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
               <AlertDialogAction onClick={handleDeleteDeck} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                    {isDeleting ? <IconLoader className="h-4 w-4 animate-spin mr-2"/> : null} Delete
               </AlertDialogAction>
             </AlertDialogFooter>
           </AlertDialogContent>
        </AlertDialog>
      </div>

    </div>
  )
}

const logDecksError = (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
        console.error('[EditDeck Page Error]:', ...args);
    }
};

