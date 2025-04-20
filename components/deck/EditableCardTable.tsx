'use client';

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
import { Textarea } from '@/components/ui/textarea'; // Using Textarea for potentially longer content
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
import { CardTagEditor } from '@/components/CardTagEditor'; // Ensure this path is correct
import { toast } from 'sonner';
import { updateCard, deleteCard } from '@/lib/actions/cardActions'; // Ensure these actions exist and path is correct
import type { Tables } from '@/types/database'; // Use your generated types

type DbCard = Tables<'cards'>;

interface EditableCardTableProps {
  initialCards: DbCard[];
  deckId: string;
  onCardUpdated: (updatedCard: DbCard) => void;
}

// Sub-component for managing row state and interactions
function EditableCardRow({
  card,
  onDelete,
  onCardUpdated
}: {
  card: DbCard;
  onDelete: (cardId: string) => Promise<void>;
  onCardUpdated: (updatedCard: DbCard) => void;
}) {
  const [questionContent, setQuestionContent] = useState(card.question ?? '');
  const [answerContent, setAnswerContent] = useState(card.answer ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // --- Debounced Update Action ---
  const debouncedUpdate = useMemo(
    () =>
      debounce(async (field: 'question' | 'answer', value: string) => {
        // Check for actual change
        if (field in card && card[field as keyof DbCard] === value) return;

        // Prevent saving empty required fields
        const trimmedValue = value.trim();
        if (!trimmedValue) {
          toast.info(`Cannot save empty ${field}.`);
          // Optional: Revert UI to original value if desired, but might be jarring
          // if (field === 'question') setQuestionContent(card.question ?? '');
          // if (field === 'answer') setAnswerContent(card.answer ?? '');
          return; // Stop before calling action
        }

        setIsSaving(true);
        // Pass correct field names to action (using trimmedValue might be safer)
        const result = await updateCard(card.id, { [field]: trimmedValue });
        setIsSaving(false);

        if (result?.error) {
          const errorMessage = typeof result.error === 'object' && result.error && 'message' in result.error 
                                ? (result.error as { message: string }).message 
                                : String(result.error);
          toast.error(`Failed to update ${field}`, {
            description: errorMessage,
          });
          if (field === 'question') setQuestionContent(card.question ?? '');
          if (field === 'answer') setAnswerContent(card.answer ?? '');
        } else {
          // Optional success toast
          // Call the callback on successful update
          if (result.data) {
            onCardUpdated(result.data); 
          }
        }
      }, 750),
    [card.id, card.question, card.answer, onCardUpdated]
  );

  // Cleanup debounce on unmount - Removed as utils/debounce might not support .cancel()
  /*
  useEffect(() => {
    return () => {
      debouncedUpdate.cancel(); 
    };
  }, [debouncedUpdate]);
  */

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
      await onDelete(card.id); // Call parent delete handler
      // No need to setIsDeleting(false) here as the row will be removed on success
      // Parent component handles UI update and closing dialog
      setShowDeleteConfirm(false); // Ensure dialog closes even if parent update is slow
  };

  return (
    <TableRow key={card.id}>
      <TableCell className="align-top py-2">
        <Textarea
          value={questionContent}
          onChange={handleQuestionChange}
          placeholder="Question content"
          className="min-h-[60px] resize-y" // Allow vertical resize
          rows={2}
          aria-label={`Question content for card ${card.id}`}
        />
      </TableCell>
      <TableCell className="align-top py-2">
        <Textarea
          value={answerContent}
          onChange={handleAnswerChange}
          placeholder="Answer content"
          className="min-h-[60px] resize-y"
          rows={2}
          aria-label={`Answer content for card ${card.id}`}
        />
      </TableCell>
      <TableCell className="align-top py-2 w-[200px]"> {/* Fixed width for tags */}
        <CardTagEditor cardId={card.id} />
      </TableCell>
      <TableCell className="align-middle py-2 text-right">
        {isSaving && <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" aria-label="Saving..."/>}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={isDeleting}
              aria-label={`Delete Card ${card.id}`}
            >
              {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                  <Trash2 className="h-4 w-4 text-destructive" />
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


// Main Table Component
export function EditableCardTable({ initialCards, deckId, onCardUpdated }: EditableCardTableProps) {
  const [cards, setCards] = useState<DbCard[]>(initialCards);
  // const [isLoading, setIsLoading] = useState(false); // General loading state if needed

  // Update local state if initialCards prop changes (e.g., after adding a new card via CardEditor below)
  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);

  const handleDeleteCard = useCallback(async (cardId: string) => {
    const result = await deleteCard(cardId);
    if (result?.error) {
        const errorMessage = typeof result.error === 'object' && result.error && 'message' in result.error 
                             ? (result.error as { message: string }).message 
                             : String(result.error);
        toast.error("Failed to delete card", { description: errorMessage });
    } else {
        toast.success("Card deleted successfully.");
        setCards((prevCards) => prevCards.filter((c) => c.id !== cardId));
    }
  }, []);


  return (
    <div className="space-y-4">
      <div className="border rounded-md overflow-x-auto"> {/* Added overflow-x-auto for responsiveness */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px] w-[35%]">Question</TableHead>
              <TableHead className="min-w-[200px] w-[35%]">Answer</TableHead>
              <TableHead className="w-[200px]">Tags</TableHead> {/* Fixed width */}
              <TableHead className="w-[80px] text-right">Actions</TableHead> {/* Adjusted width */}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                  No cards in this deck yet. Use the "Add Card" section below.
                </TableCell>
              </TableRow>
            ) : (
              cards.map((card) => (
                <EditableCardRow
                  key={card.id}
                  card={card}
                  onDelete={handleDeleteCard}
                  onCardUpdated={onCardUpdated}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 