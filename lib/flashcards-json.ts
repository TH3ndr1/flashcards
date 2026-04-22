/**
 * Client-safe parsing and building of flashcard JSON for import/export.
 * Field rules align with createCardSchema in lib/actions/cardActions.ts.
 */

import type { Tables } from "@/types/database";

/** Aligned with CreateCardInput from cardActions (zod) — no "use server" import for client use. */
export type NormalizedCardInput = {
  question: string;
  answer: string;
  question_part_of_speech: string | null;
  question_gender: string | null;
  answer_part_of_speech: string | null;
  answer_gender: string | null;
};

export const FLASHCARDS_JSON_FORMAT = "flashcards-deck" as const;
export const FLASHCARDS_JSON_VERSION = 1;
export const MAX_IMPORT_CARDS = 5_000;
export const MAX_IMPORT_JSON_BYTES = 4 * 1024 * 1024; // 4 MB

type DbCard = Tables<"cards">;

export type FlashcardsExportWrapper = {
  format: typeof FLASHCARDS_JSON_FORMAT;
  version: number;
  exportedAt: string;
  deckName: string;
  /** Mirrors AI / API export: classification + Q/A, plus optional deck language fields for round-trip. */
  cards: Array<{
    question: string;
    answer: string;
    questionLanguage?: string;
    answerLanguage?: string;
    isBilingual?: boolean;
    questionPartOfSpeech: string | null;
    questionGender: string | null;
    answerPartOfSpeech: string | null;
    answerGender: string | null;
  }>;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Coerce a single import row to NormalizedCardInput, or return an error message.
 */
function normalizeOneRow(
  row: unknown,
  index: number
): { ok: true; card: NormalizedCardInput } | { ok: false; reason: string } {
  if (!isRecord(row)) {
    return { ok: false, reason: `Row ${index}: expected object, got ${typeof row}` };
  }

  const q =
    typeof row.question === "string" ? row.question.trim() : "";
  const a =
    typeof row.answer === "string" ? row.answer.trim() : "";

  if (!q) {
    return { ok: false, reason: `Row ${index}: question missing or empty` };
  }
  if (!a) {
    return { ok: false, reason: `Row ${index}: answer missing or empty` };
  }

  const qp = row.questionPartOfSpeech ?? row.question_part_of_speech;
  const qg = row.questionGender ?? row.question_gender;
  const ap = row.answerPartOfSpeech ?? row.answer_part_of_speech;
  const ag = row.answerGender ?? row.answer_gender;

  return {
    ok: true,
    card: {
      question: q,
      answer: a,
      question_part_of_speech: typeof qp === "string" ? qp : null,
      question_gender: typeof qg === "string" ? qg : null,
      answer_part_of_speech: typeof ap === "string" ? ap : null,
      answer_gender: typeof ag === "string" ? ag : null,
    },
  };
}

/**
 * Unwraps legacy `[...]` or `{ format, version?, cards: [...] }` into a raw array.
 */
export function extractCardsArrayFromParsedJson(
  parsed: unknown
): { ok: true; rows: unknown[] } | { ok: false; error: string } {
  if (Array.isArray(parsed)) {
    return { ok: true, rows: parsed };
  }
  if (isRecord(parsed)) {
    const cards = parsed.cards;
    if (!Array.isArray(cards)) {
      // fall through to error
    } else {
      if (parsed.format === FLASHCARDS_JSON_FORMAT) {
        return { ok: true, rows: cards };
      }
      if (parsed.format === undefined && (parsed.version === 1 || parsed.version === undefined)) {
        return { ok: true, rows: cards };
      }
      if (typeof parsed.format === "string" && parsed.format !== FLASHCARDS_JSON_FORMAT) {
        return {
          ok: false,
          error: `Unknown "format" field: expected "${FLASHCARDS_JSON_FORMAT}".`,
        };
      }
    }
  }
  return {
    ok: false,
    error: 'Expected a JSON array of cards or an object with a "cards" array (flashcards-deck).',
  };
}

export type ParseFlashcardsResult =
  | {
      ok: true;
      cards: NormalizedCardInput[];
      skipped: number;
      /** First reasons for skipped rows (capped) */
      skipReasons: string[];
      /** Non-fatal messages (e.g. row count cap) */
      warnings: string[];
    }
  | { ok: false; error: string };

const MAX_SKIP_REASONS = 12;

/**
 * Parse already-`JSON.parse`d data into NormalizedCardInput[].
 * Enforces max card count. Does not enforce byte size (caller: check `MAX_IMPORT_JSON_BYTES` on string before parse).
 */
export function parseFlashcardsJson(parsed: unknown): ParseFlashcardsResult {
  const extracted = extractCardsArrayFromParsedJson(parsed);
  if (!extracted.ok) {
    return { ok: false, error: extracted.error };
  }
  const rows = extracted.rows;
  const warnings: string[] = [];
  if (rows.length > MAX_IMPORT_CARDS) {
    return {
      ok: false,
      error: `Too many cards: ${rows.length} (max ${MAX_IMPORT_CARDS}).`,
    };
  }
  if (rows.length === 0) {
    return { ok: true, cards: [], skipped: 0, skipReasons: [], warnings: [] };
  }

  const cards: NormalizedCardInput[] = [];
  const skipReasons: string[] = [];
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const out = normalizeOneRow(rows[i], i);
    if (out.ok) {
      cards.push(out.card);
    } else {
      skipped += 1;
      if (skipReasons.length < MAX_SKIP_REASONS) {
        skipReasons.push(out.reason);
      }
    }
  }

  if (cards.length === 0 && skipped > 0) {
    warnings.push("No valid cards after parsing; check row shape and non-empty Q/A.");
  }

  return { ok: true, cards, skipped, skipReasons, warnings };
}

type DeckForExport = Pick<
  Tables<"decks">,
  "name" | "primary_language" | "secondary_language" | "is_bilingual"
>;

/**
 * Build the canonical v1 export object for download (stringify in the UI).
 */
export function buildFlashcardsExportPayload(
  deck: DeckForExport,
  cardRows: Pick<
    DbCard,
    "question" | "answer" | "question_part_of_speech" | "question_gender" | "answer_part_of_speech" | "answer_gender"
  >[]
): FlashcardsExportWrapper {
  const primary = deck.primary_language ?? "en";
  const secondary = deck.secondary_language ?? primary;

  return {
    format: FLASHCARDS_JSON_FORMAT,
    version: FLASHCARDS_JSON_VERSION,
    exportedAt: new Date().toISOString(),
    deckName: deck.name,
    cards: cardRows.map((c) => ({
      question: c.question,
      answer: c.answer,
      questionLanguage: primary,
      answerLanguage: deck.is_bilingual ? secondary : primary,
      isBilingual: deck.is_bilingual,
      questionPartOfSpeech: c.question_part_of_speech,
      questionGender: c.question_gender,
      answerPartOfSpeech: c.answer_part_of_speech,
      answerGender: c.answer_gender,
    })),
  };
}

export function safeFilenameFromDeckName(name: string): string {
  return (name || "deck").replace(/[^\w\s.-]/g, "_").slice(0, 200);
}
