// components/deck/EditableCardTable.tsx
"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  moveCardsToNewDeck,
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
            aria-label="Select card"
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
              aria-label="Delete card"
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
  deckName: string;
  onCardUpdated: (updatedCard: DbCard) => void;
  onCardsRemoved: (cardIds: string[]) => void;
}

export function EditableCardTable({
  initialCards,
  deckId,
  deckName,
  onCardUpdated,
  onCardsRemoved,
}: EditableCardTableProps) {
  const router = useRouter();
  const [cardsToDisplay, setCardsToDisplay] = useState<DbCard[]>(initialCards);
  const [isMultiEditMode, setIsMultiEditMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());

  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Move dialog state
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveTab, setMoveTab] = useState<'new' | 'existing'>('new');
  const [newDeckName, setNewDeckName] = useState('');
  const [availableDecks, setAvailableDecks] = useState<Array<{ id: string; name: string }>>([]);
  const [targetDeckId, setTargetDeckId] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    setCardsToDisplay(initialCards);
  }, [initialCards]);

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
    setNewDeckName(`${deckName}_extracted`);
    setMoveTab('new');
    setShowMoveDialog(true);
  }, [deckId, deckName]);

  const finishMove = useCallback((ids: string[], targetName: string, newDeckId?: string) => {
    setCardsToDisplay(prev => prev.filter(c => !ids.includes(c.id)));
    onCardsRemoved(ids);
    setSelectedCardIds(new Set());
    setShowMoveDialog(false);
    setIsMultiEditMode(false);
    if (newDeckId) {
      toast.success(
        `Moved ${ids.length} card(s) to new deck "${targetName}".`,
        {
          action: {
            label: 'Open deck',
            onClick: () => router.push(`/edit/${newDeckId}`),
          },
        }
      );
    } else {
      toast.success(`Moved ${ids.length} card(s) to "${targetName}".`);
    }
  }, [onCardsRemoved, router]);

  const handleMoveToNewDeck = useCallback(async () => {
    const trimmed = newDeckName.trim();
    if (!trimmed) return;
    const ids = Array.from(selectedCardIds);
    setIsMoving(true);
    const result = await moveCardsToNewDeck(ids, deckId, trimmed);
    setIsMoving(false);

    if (result?.error) {
      toast.error('Failed to create deck and move cards', { description: String(result.error) });
    } else {
      finishMove(ids, trimmed, result.data?.newDeckId);
    }
  }, [newDeckName, selectedCardIds, deckId, finishMove]);

  const handleMoveToExistingDeck = useCallback(async () => {
    if (!targetDeckId) return;
    const ids = Array.from(selectedCardIds);
    setIsMoving(true);
    const result = await moveCardsToDeck(ids, targetDeckId);
    setIsMoving(false);

    if (result?.error) {
      toast.error('Failed to move cards', { description: String(result.error) });
    } else {
      const targetName = availableDecks.find(d => d.id === targetDeckId)?.name ?? 'the target deck';
      finishMove(ids, targetName);
    }
  }, [targetDeckId, selectedCardIds, availableDecks, finishMove]);

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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move {selectedCount} card{selectedCount !== 1 ? 's' : ''} to another deck</DialogTitle>
            <DialogDescription>
              All card details (learning progress, word types, etc.) will be preserved.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={moveTab} onValueChange={v => setMoveTab(v as 'new' | 'existing')} className="mt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new">New deck</TabsTrigger>
              <TabsTrigger value="existing">Existing deck</TabsTrigger>
            </TabsList>

            {/* ── New deck tab ── */}
            <TabsContent value="new" className="pt-4 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="new-deck-name">Deck name</Label>
                <Input
                  id="new-deck-name"
                  value={newDeckName}
                  onChange={e => setNewDeckName(e.target.value)}
                  placeholder="e.g. My Deck_extracted"
                  disabled={isMoving}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Language settings and tags will be copied from the current deck.
              </p>
            </TabsContent>

            {/* ── Existing deck tab ── */}
            <TabsContent value="existing" className="pt-4 space-y-3">
              {availableDecks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No other active decks found.</p>
              ) : (
                <div className="space-y-1">
                  <Label>Target deck</Label>
                  <Select value={targetDeckId} onValueChange={setTargetDeckId} disabled={isMoving}>
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
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                The existing deck&apos;s settings will not be changed.
              </p>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowMoveDialog(false)} disabled={isMoving}>
              Cancel
            </Button>
            {moveTab === 'new' ? (
              <Button
                onClick={handleMoveToNewDeck}
                disabled={!newDeckName.trim() || isMoving}
              >
                {isMoving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
                Create & Move
              </Button>
            ) : (
              <Button
                onClick={handleMoveToExistingDeck}
                disabled={!targetDeckId || isMoving || availableDecks.length === 0}
              >
                {isMoving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
                Move Cards
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
