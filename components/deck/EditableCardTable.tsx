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
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Loader2, ArrowRightLeft } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  updateCard as updateCardAction,
  deleteCard as deleteCardAction,
  deleteCardsBatch,
  moveCardsToDeck,
  getActiveDecksList,
} from '@/lib/actions/cardActions';
import type { Tables } from '@/types/database';
import { appLogger } from '@/lib/logger';

type DbCard = Tables<'cards'>;
type UpdateCardPayload = Partial<Pick<DbCard, 'question' | 'answer'>>;


interface EditableCardRowProps {
  card: DbCard;
  isSelected: boolean;
  isMultiEditMode: boolean;
  onToggleSelect: (cardId: string) => void;
  onDelete: (cardId: string) => Promise<void>;
  onCardUpdatedInParent: (updatedCard: DbCard) => void;
}

function EditableCardRow({
  card,
  isSelected,
  isMultiEditMode,
  onToggleSelect,
  onDelete,
  onCardUpdatedInParent,
}: EditableCardRowProps) {
  const [questionContent, setQuestionContent] = useState(card.question ?? '');
  const [answerContent, setAnswerContent] = useState(card.answer ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync with prop changes
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
        if (
          (field === 'question' && card.question === trimmedValue) ||
          (field === 'answer' && card.answer === trimmedValue)
        ) {
          return;
        }

        setIsSaving(true);
        const payload: UpdateCardPayload = { [field]: trimmedValue };
        const result = await updateCardAction(card.id, payload);
        setIsSaving(false);

        if (result?.error) {
          toast.error(`Failed to update ${field}`, { description: String(result.error) });
          if (field === 'question') setQuestionContent(card.question ?? '');
          if (field === 'answer') setAnswerContent(card.answer ?? '');
        } else if (result.data) {
          onCardUpdatedInParent(result.data);
        }
      }, 750),
    [card.id, card.question, card.answer, onCardUpdatedInParent]
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
    setShowDeleteConfirm(false);
  };

  return (
    <TableRow className={isSelected ? 'bg-muted/50' : undefined}>
      {isMultiEditMode && (
        <TableCell className="align-middle py-2 w-10 pl-4">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(card.id)}
            aria-label={`Select card`}
            disabled={isDeleting}
          />
        </TableCell>
      )}
      <TableCell className="align-top py-2">
        <Textarea
          value={questionContent}
          onChange={handleQuestionChange}
          placeholder="Question content"
          className="min-h-[60px] resize-y text-sm"
          rows={2}
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
          disabled={isDeleting}
        />
      </TableCell>
      <TableCell className="align-middle py-2 text-right">
        {isSaving && <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" aria-label="Saving..." />}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={isDeleting || isSaving}
              aria-label={`Delete card`}
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
  initialCards: DbCard[];
  deckId: string;
  onCardUpdated: (updatedCard: DbCard) => void;
  onCardsRemoved: (cardIds: string[]) => void;
}

export function EditableCardTable({
  initialCards,
  deckId,
  onCardUpdated,
  onCardsRemoved,
}: EditableCardTableProps) {
  const [cardsToDisplay, setCardsToDisplay] = useState<DbCard[]>(initialCards);
  const [isMultiEditMode, setIsMultiEditMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [availableDecks, setAvailableDecks] = useState<Array<{ id: string; name: string }>>([]);
  const [targetDeckId, setTargetDeckId] = useState('');
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    setCardsToDisplay(initialCards);
  }, [initialCards]);

  // Clear selection when leaving multi-edit mode
  useEffect(() => {
    if (!isMultiEditMode) setSelectedCardIds(new Set());
  }, [isMultiEditMode]);

  const handleToggleSelect = useCallback((cardId: string) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }, []);

  const allSelected = cardsToDisplay.length > 0 && selectedCardIds.size === cardsToDisplay.length;
  const someSelected = selectedCardIds.size > 0 && !allSelected;

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedCardIds(new Set());
    } else {
      setSelectedCardIds(new Set(cardsToDisplay.map(c => c.id)));
    }
  }, [allSelected, cardsToDisplay]);

  const handleDeleteCard = useCallback(async (cardId: string) => {
    const result = await deleteCardAction(cardId);
    if (result?.error) {
      toast.error('Failed to delete card', { description: String(result.error) });
    } else {
      toast.success('Card deleted successfully.');
      setCardsToDisplay(prev => prev.filter(c => c.id !== cardId));
      onCardsRemoved([cardId]);
    }
  }, [onCardsRemoved]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedCardIds);
    setIsBulkDeleting(true);
    const result = await deleteCardsBatch(ids);
    setIsBulkDeleting(false);
    setShowBulkDeleteDialog(false);

    if (result?.error) {
      toast.error('Failed to delete cards', { description: String(result.error) });
    } else {
      toast.success(`Deleted ${result.data?.deletedCount ?? ids.length} card(s).`);
      setCardsToDisplay(prev => prev.filter(c => !ids.includes(c.id)));
      onCardsRemoved(ids);
      setSelectedCardIds(new Set());
    }
  }, [selectedCardIds, onCardsRemoved]);

  const handleOpenMoveDialog = useCallback(async () => {
    const result = await getActiveDecksList();
    if (result.error) {
      toast.error('Failed to load decks', { description: String(result.error) });
      return;
    }
    setAvailableDecks((result.data ?? []).filter(d => d.id !== deckId));
    setTargetDeckId('');
    setShowMoveDialog(true);
  }, [deckId]);

  const handleMoveCards = useCallback(async () => {
    if (!targetDeckId) return;
    const ids = Array.from(selectedCardIds);
    setIsMoving(true);
    const result = await moveCardsToDeck(ids, targetDeckId);
    setIsMoving(false);

    if (result?.error) {
      toast.error('Failed to move cards', { description: String(result.error) });
    } else {
      const targetName = availableDecks.find(d => d.id === targetDeckId)?.name ?? 'the target deck';
      toast.success(`Moved ${result.data?.movedCount ?? ids.length} card(s) to "${targetName}".`);
      setCardsToDisplay(prev => prev.filter(c => !ids.includes(c.id)));
      onCardsRemoved(ids);
      setSelectedCardIds(new Set());
      setShowMoveDialog(false);
      setIsMultiEditMode(false);
    }
  }, [targetDeckId, selectedCardIds, availableDecks, onCardsRemoved]);

  const selectedCount = selectedCardIds.size;

  return (
    <div className="space-y-4">
      {/* Multi-edit toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            id="multi-edit-toggle"
            checked={isMultiEditMode}
            onCheckedChange={setIsMultiEditMode}
          />
          <Label htmlFor="multi-edit-toggle" className="text-sm cursor-pointer">
            Select multiple
          </Label>
        </div>

        {/* Bulk action toolbar */}
        {isMultiEditMode && selectedCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selectedCount} selected</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenMoveDialog}
              disabled={isBulkDeleting}
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Move to Deck
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteDialog(true)}
              disabled={isBulkDeleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected
            </Button>
          </div>
        )}
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {isMultiEditMode && (
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all cards"
                  />
                </TableHead>
              )}
              <TableHead className="min-w-[200px] w-[45%] pl-4">Question</TableHead>
              <TableHead className="min-w-[200px] w-[45%]">Answer</TableHead>
              <TableHead className="w-[10%] text-right pr-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cardsToDisplay.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isMultiEditMode ? 4 : 3}
                  className="text-center h-24 text-muted-foreground"
                >
                  No cards in this deck. Add new cards using the "Add Card" button below or in the Card View.
                </TableCell>
              </TableRow>
            ) : (
              cardsToDisplay.map(card => (
                <EditableCardRow
                  key={card.id}
                  card={card}
                  isSelected={selectedCardIds.has(card.id)}
                  isMultiEditMode={isMultiEditMode}
                  onToggleSelect={handleToggleSelect}
                  onDelete={handleDeleteCard}
                  onCardUpdatedInParent={onCardUpdated}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Bulk delete confirmation */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} card{selectedCount !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected flashcard{selectedCount !== 1 ? 's' : ''} will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isBulkDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move to deck dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {selectedCount} card{selectedCount !== 1 ? 's' : ''} to another deck</DialogTitle>
            <DialogDescription>
              All card details (learning progress, word types, etc.) will be preserved.
              Only the deck assignment changes.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="mb-2 block text-sm">Target deck</Label>
            {availableDecks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No other active decks found.</p>
            ) : (
              <Select value={targetDeckId} onValueChange={setTargetDeckId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a deck…" />
                </SelectTrigger>
                <SelectContent>
                  {availableDecks.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)} disabled={isMoving}>
              Cancel
            </Button>
            <Button onClick={handleMoveCards} disabled={!targetDeckId || isMoving || availableDecks.length === 0}>
              {isMoving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
              Move Cards
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
