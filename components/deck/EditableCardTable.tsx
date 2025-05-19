// components/deck/EditableCardTable.tsx
"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { debounce } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';
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
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { updateCard as updateCardAction, deleteCard as deleteCardAction } from '@/lib/actions/cardActions'; // Renamed to avoid conflict
import type { Tables } from '@/types/database';
import { appLogger, statusLogger } from '@/lib/logger';

// Use Tables<'cards'> for card data
type DbCard = Tables<'cards'>;
// Define input type for updateCardAction (snake_case)
type UpdateCardPayload = Partial<Pick<DbCard, 'question' | 'answer'>>;


interface EditableCardRowProps {
  card: DbCard;
  onDelete: (cardId: string) => Promise<void>; // Parent handles actual deletion and state update
  onCardUpdatedInParent: (updatedCard: DbCard) => void; // To notify parent of successful save
}

function EditableCardRow({ card, onDelete, onCardUpdatedInParent }: EditableCardRowProps) {
  const [questionContent, setQuestionContent] = useState(card.question ?? '');
  const [answerContent, setAnswerContent] = useState(card.answer ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync with prop changes (e.g., if parent updates the card after optimistic update)
  useEffect(() => {
    setQuestionContent(card.question ?? '');
    setAnswerContent(card.answer ?? '');
  }, [card.question, card.answer]);


  const debouncedUpdate = useMemo(
    () =>
      debounce(async (field: 'question' | 'answer', value: string) => {
        const trimmedValue = value.trim();
        if (!trimmedValue) {
          toast.info(`Cannot save empty ${field}.`);
          return;
        }

        // Check if value actually changed from the card prop to prevent unnecessary saves
        if ((field === 'question' && card.question === trimmedValue) ||
            (field === 'answer' && card.answer === trimmedValue)) {
            // appLogger.info(`[EditableCardRow] No actual change detected for ${field} on card ${card.id}. Skipping save.`);
            return;
        }

        setIsSaving(true);
        const payload: UpdateCardPayload = { [field]: trimmedValue };
        const result = await updateCardAction(card.id, payload);
        setIsSaving(false);

        if (result?.error) {
          toast.error(`Failed to update ${field}`, { description: String(result.error) });
          // Revert UI to original prop value on error
          if (field === 'question') setQuestionContent(card.question ?? '');
          if (field === 'answer') setAnswerContent(card.answer ?? '');
        } else if (result.data) {
          // toast.success(`Card ${field} updated!`); // Optional: can be too noisy
          onCardUpdatedInParent(result.data); // Notify parent of successful update with new data
        }
      }, 750),
    [card.id, card.question, card.answer, onCardUpdatedInParent] // card.question/answer for checking change
  );

  const handleQuestionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuestionContent(e.target.value);
    debouncedUpdate('question', e.target.value);
  };

  const handleAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setAnswerContent(e.target.value);
    debouncedUpdate('answer', e.target.value);
  };

  const handleDeleteConfirm = async () => {
      setIsDeleting(true);
      await onDelete(card.id);
      // Parent will remove the row from its state, which re-renders the table
      // No need to setIsDeleting(false) if row is removed.
      setShowDeleteConfirm(false);
  };

  return (
    <TableRow>
      <TableCell className="align-top py-2">
        <Textarea
          value={questionContent}
          onChange={handleQuestionChange}
          placeholder="Question content"
          className="min-h-[60px] resize-y text-sm"
          rows={2}
          aria-label={`Question content for card ${card.id}`}
          disabled={isDeleting}
        />
      </TableCell>
      <TableCell className="align-top py-2">
        <Textarea
          value={answerContent}
          onChange={handleAnswerChange}
          placeholder="Answer content"
          className="min-h-[60px] resize-y text-sm"
          rows={2}
          aria-label={`Answer content for card ${card.id}`}
          disabled={isDeleting}
        />
      </TableCell>
      <TableCell className="align-middle py-2 text-right">
        {isSaving && <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" aria-label="Saving..."/>}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8" // Slightly larger hit area
              disabled={isDeleting || isSaving}
              aria-label={`Delete Card ${card.id}`}
            >
              {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this flashcard.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}


interface EditableCardTableProps {
  initialCards: DbCard[]; // Expect full DbCard objects
  deckId: string; // Still needed for context, though not directly used in this component if actions are global
  onCardUpdated: (updatedCard: DbCard) => void; // Callback to parent when a card is successfully updated via action
  // onDeleteCard from parent is now passed directly to EditableCardRow and handled there
}

export function EditableCardTable({ initialCards, onCardUpdated }: EditableCardTableProps) {
  // The 'cards' state is now managed by the parent useEditDeck hook.
  // This component receives 'initialCards' and renders them.
  // Updates are propagated upwards via onCardUpdated.
  // Deletions are handled by the parent after confirmation.

  const [cardsToDisplay, setCardsToDisplay] = useState<DbCard[]>(initialCards);

  // Sync with initialCards prop if it changes (e.g., parent adds/removes a card)
  useEffect(() => {
    setCardsToDisplay(initialCards);
  }, [initialCards]);


  const handleDeleteCardFromParent = useCallback(async (cardId: string) => {
    const result = await deleteCardAction(cardId); // Call the server action directly
    if (result?.error) {
        toast.error("Failed to delete card", { description: String(result.error) });
    } else {
        toast.success("Card deleted successfully.");
        // Update local display list
        setCardsToDisplay((prevCards) => prevCards.filter((c) => c.id !== cardId));
        // No need to call onCardUpdated for delete, parent already knows via its own handler
    }
  }, []);


  return (
    <div className="space-y-4">
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px] w-[45%] pl-4">Question</TableHead>
              <TableHead className="min-w-[200px] w-[45%]">Answer</TableHead>
              <TableHead className="w-[10%] text-right pr-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cardsToDisplay.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                  No cards in this deck. Add new cards using the "Add Card" button below or in the Card View.
                </TableCell>
              </TableRow>
            ) : (
              cardsToDisplay.map((card) => (
                <EditableCardRow
                  key={card.id}
                  card={card}
                  onDelete={handleDeleteCardFromParent} // Pass the direct delete handler
                  onCardUpdatedInParent={onCardUpdated}    // Pass the update notification handler
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}