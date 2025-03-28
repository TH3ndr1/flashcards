// src/components/study/deck-header.tsx
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/alert-dialog";

interface DeckHeaderProps {
  deckName: string;
  onReset: () => void;
  showReset: boolean;
}

export function DeckHeader({ deckName, onReset, showReset }: DeckHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
      <div className="flex items-center">
        <Link href="/" className="mr-2" aria-label="Back to decks">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold truncate" title={deckName}>{deckName}</h1>
      </div>
      <div className="flex items-center space-x-2">
        {showReset && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <RotateCcw className="mr-2 h-4 w-4" /> Reset Progress
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Reset</AlertDialogTitle>
                <AlertDialogDescription>
                  Reset all study progress for this deck? This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onReset}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Reset Now
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}

// Optionally use export default if preferred
// export default DeckHeader;