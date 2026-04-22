"use client";

import { useCallback, useRef, useState } from "react";
import { Database } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { importCardsToDeck, type CreateCardInput, type ImportCardsMode } from "@/lib/actions/cardActions";
import {
  buildFlashcardsExportPayload,
  MAX_IMPORT_JSON_BYTES,
  parseFlashcardsJson,
  safeFilenameFromDeckName,
} from "@/lib/flashcards-json";
import type { Tables } from "@/types/database";

type DbCard = Tables<"cards">;

type DeckJsonDataMenuProps = {
  deckId: string;
  deck: Pick<Tables<"decks">, "name" | "primary_language" | "secondary_language" | "is_bilingual">;
  /** Deck editor state may use partial card rows; export skips incomplete rows. */
  cards: Array<
    Partial<
      Pick<
        DbCard,
        | "question"
        | "answer"
        | "question_part_of_speech"
        | "question_gender"
        | "answer_part_of_speech"
        | "answer_gender"
      >
    >
  >;
  onImportComplete: () => Promise<void>;
  canUseDataTools: boolean;
};

export function DeckJsonDataMenu({
  deckId,
  deck,
  cards,
  onImportComplete,
  canUseDataTools,
}: DeckJsonDataMenuProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);
  const [importMode, setImportMode] = useState<ImportCardsMode>("append");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsePreview, setParsePreview] = useState<{
    valid: number;
    skipped: number;
    skipReasons: string[];
    samples: Array<{ q: string; a: string }>;
    payload: CreateCardInput[];
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    const rows = cards
      .filter(
        (c): c is typeof c & { question: string; answer: string } =>
          Boolean(c.question?.trim() && c.answer?.trim())
      )
      .map((c) => ({
        question: c.question,
        answer: c.answer,
        question_part_of_speech: c.question_part_of_speech ?? null,
        question_gender: c.question_gender ?? null,
        answer_part_of_speech: c.answer_part_of_speech ?? null,
        answer_gender: c.answer_gender ?? null,
      }));
    if (rows.length === 0) {
      toast.error("No cards to export.");
      return;
    }
    const payload = buildFlashcardsExportPayload(deck, rows);
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFilenameFromDeckName(deck.name)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Deck exported as JSON.");
  }, [cards, deck]);

  const resetImportState = useCallback(() => {
    setFileName(null);
    setParsePreview(null);
    setImportMode("append");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const readAndParseFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_IMPORT_JSON_BYTES) {
        toast.error(`File is too large (max ${Math.round(MAX_IMPORT_JSON_BYTES / (1024 * 1024))} MB).`);
        return;
      }
      setFileName(file.name);
      let text: string;
      try {
        text = await file.text();
      } catch {
        toast.error("Could not read the file.");
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        toast.error("Invalid JSON. Check the file and try again.");
        return;
      }
      const result = parseFlashcardsJson(parsed);
      if (!result.ok) {
        toast.error(result.error);
        setParsePreview(null);
        return;
      }
      const asInputs: CreateCardInput[] = result.cards.map((c) => ({
        question: c.question,
        answer: c.answer,
        question_part_of_speech: c.question_part_of_speech,
        question_gender: c.question_gender,
        answer_part_of_speech: c.answer_part_of_speech,
        answer_gender: c.answer_gender,
      }));
      const samples = asInputs.slice(0, 3).map((c) => ({
        q: c.question.slice(0, 80) + (c.question.length > 80 ? "…" : ""),
        a: c.answer.slice(0, 80) + (c.answer.length > 80 ? "…" : ""),
      }));
      setParsePreview({
        valid: asInputs.length,
        skipped: result.skipped,
        skipReasons: result.skipReasons,
        samples,
        payload: asInputs,
      });
      if (result.warnings.length > 0) {
        for (const w of result.warnings) toast.info(w);
      }
    },
    []
  );

  const runImport = useCallback(async () => {
    if (!parsePreview || parsePreview.valid === 0) {
      toast.error("No valid cards to import.");
      return;
    }
    setIsSubmitting(true);
    const toastId = toast.loading("Importing cards…");
    try {
      const res = await importCardsToDeck(deckId, importMode, parsePreview.payload);
      if (res.error || res.data == null) {
        throw new Error(res.error ?? "Import failed.");
      }
      toast.success(
        `Imported ${res.data.insertedCount} card${res.data.insertedCount === 1 ? "" : "s"}.`,
        { id: toastId }
      );
      setImportOpen(false);
      setReplaceConfirmOpen(false);
      resetImportState();
      await onImportComplete();
    } catch (e: unknown) {
      toast.error((e as Error).message, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  }, [deckId, importMode, onImportComplete, parsePreview, resetImportState]);

  const onClickImportInDialog = useCallback(() => {
    if (!parsePreview || parsePreview.valid === 0) {
      toast.error("No valid cards to import.");
      return;
    }
    if (importMode === "replace") {
      setReplaceConfirmOpen(true);
      return;
    }
    void runImport();
  }, [importMode, parsePreview, runImport]);

  if (!canUseDataTools) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2" type="button" title="Export or import card data as JSON">
            <Database className="h-4 w-4" />
            Data
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={handleExport}>
            Export JSON
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            onClick={() => {
              resetImportState();
              setImportOpen(true);
            }}
          >
            Import JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void readAndParseFile(f);
        }}
      />

      <Dialog
        open={importOpen}
        onOpenChange={(o) => {
          setImportOpen(o);
          if (!o) resetImportState();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import JSON</DialogTitle>
            <DialogDescription>
              JSON does not include study progress. &quot;Replace all cards&quot; removes existing cards in this
              deck and their scheduling; regenerate the Story tab afterward if you use it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
              >
                Choose file…
              </Button>
              {fileName && <span className="text-sm text-muted-foreground truncate max-w-[220px]">{fileName}</span>}
            </div>

            {parsePreview && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-2">
                <p>
                  <span className="font-medium">{parsePreview.valid}</span> valid card
                  {parsePreview.valid === 1 ? "" : "s"}
                  {parsePreview.skipped > 0 && (
                    <span className="text-muted-foreground"> ({parsePreview.skipped} skipped)</span>
                  )}
                  {parsePreview.skipReasons.length > 0 && (
                    <span className="text-muted-foreground text-xs block mt-1">
                      {parsePreview.skipReasons.slice(0, 3).join(" · ")}
                    </span>
                  )}
                </p>
                {parsePreview.samples.length > 0 && (
                  <ul className="list-disc pl-4 space-y-1 text-xs font-mono text-muted-foreground">
                    {parsePreview.samples.map((s, i) => (
                      <li key={i}>
                        {s.q} → {s.a}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div>
              <Label className="text-sm font-medium">Import mode</Label>
              <RadioGroup
                className="mt-2 space-y-2"
                value={importMode}
                onValueChange={(v) => setImportMode(v as ImportCardsMode)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="append" id="m-append" />
                  <Label htmlFor="m-append" className="font-normal cursor-pointer">
                    Add to this deck
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="replace" id="m-replace" />
                  <Label htmlFor="m-replace" className="font-normal cursor-pointer text-destructive">
                    Replace all cards in this deck
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setImportOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onClickImportInDialog}
              disabled={isSubmitting || !parsePreview || parsePreview.valid === 0}
            >
              {isSubmitting ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={replaceConfirmOpen} onOpenChange={setReplaceConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace all cards?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete every card in this deck and its study history, then import {parsePreview?.valid ?? 0}{" "}
              new card{parsePreview?.valid === 1 ? "" : "s"}. Saved stories for this deck will be cleared. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={isSubmitting}
              onClick={() => void runImport()}
            >
              {isSubmitting ? "Replacing…" : "Replace and import"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
