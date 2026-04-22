import {
  buildFlashcardsExportPayload,
  extractCardsArrayFromParsedJson,
  parseFlashcardsJson,
  MAX_IMPORT_CARDS,
  FLASHCARDS_JSON_FORMAT,
} from "./flashcards-json";

describe("extractCardsArrayFromParsedJson", () => {
  it("accepts legacy top-level array", () => {
    const r = extractCardsArrayFromParsedJson([{ question: "a", answer: "b" }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rows).toHaveLength(1);
  });

  it("accepts wrapped flashcards-deck v1", () => {
    const r = extractCardsArrayFromParsedJson({
      format: FLASHCARDS_JSON_FORMAT,
      version: 1,
      cards: [{ question: "a", answer: "b" }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rows).toHaveLength(1);
  });

  it("rejects non-array non-wrapper", () => {
    const r = extractCardsArrayFromParsedJson({ foo: 1 });
    expect(r.ok).toBe(false);
  });
});

describe("parseFlashcardsJson", () => {
  it("normalizes AI-style camelCase rows", () => {
    const r = parseFlashcardsJson([
      {
        question: "  hi  ",
        answer: "yo",
        questionPartOfSpeech: "Noun",
        questionGender: "M",
        answerPartOfSpeech: "N",
        answerGender: "F",
        source: "x.jpg",
        fileType: "image",
      },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cards).toHaveLength(1);
      expect(r.cards[0].question).toBe("hi");
      expect(r.cards[0].answer).toBe("yo");
      expect(r.skipped).toBe(0);
    }
  });

  it("accepts snake_case classification fields", () => {
    const r = parseFlashcardsJson([
      {
        question: "a",
        answer: "b",
        question_part_of_speech: "N/A",
        question_gender: "N/A",
        answer_part_of_speech: "N/A",
        answer_gender: "N/A",
      },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cards[0].question_part_of_speech).toBe("N/A");
    }
  });

  it("skips invalid rows and counts them", () => {
    const r = parseFlashcardsJson([
      { question: "ok", answer: "yes" },
      { question: "", answer: "no" },
      { question: "q", answer: "" },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cards).toHaveLength(1);
      expect(r.skipped).toBe(2);
      expect(r.skipReasons.length).toBeGreaterThan(0);
    }
  });

  it("rejects more than max cards", () => {
    const big = new Array(MAX_IMPORT_CARDS + 1)
      .fill(null)
      .map((_, i) => ({ question: `q${i}`, answer: "a" }));
    const r = parseFlashcardsJson(big);
    expect(r.ok).toBe(false);
  });

  it("returns empty success for empty array", () => {
    const r = parseFlashcardsJson([]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cards).toEqual([]);
    }
  });
});

describe("buildFlashcardsExportPayload", () => {
  it("produces a wrapper and derived language fields", () => {
    const payload = buildFlashcardsExportPayload(
      {
        name: "Test",
        primary_language: "fr",
        secondary_language: "nl",
        is_bilingual: true,
      },
      [
        {
          question: "un",
          answer: "een",
          question_part_of_speech: "N",
          question_gender: "M",
          answer_part_of_speech: "N",
          answer_gender: "N",
        },
      ]
    );
    expect(payload.format).toBe(FLASHCARDS_JSON_FORMAT);
    expect(payload.version).toBe(1);
    expect(payload.deckName).toBe("Test");
    expect(payload.cards[0].question).toBe("un");
    expect(payload.cards[0].questionLanguage).toBe("fr");
    expect(payload.cards[0].answerLanguage).toBe("nl");
    expect(payload.cards[0].isBilingual).toBe(true);
  });
});
