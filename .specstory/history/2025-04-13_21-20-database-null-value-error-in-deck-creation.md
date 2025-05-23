<!-- Generated by SpecStory -->

# Database Null Value Error in Deck Creation (2025-04-13 23:20:27)

_**User**_

Error: null value in column "language" of relation "decks" violates not-null constraint
    at createDeck (rsc://React/Server/webpack-internal:///(action-browser)/./lib/actions/deckActions.ts?14:266:24)
    at resolveErrorDev (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@15.2.4_@babel+core@7.26.10_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/compiled/react-server-dom-webpack/cjs/react-server-dom-webpack-client.browser.development.js:1845:46)
    at getOutlinedModel (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@15.2.4_@babel+core@7.26.10_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/compiled/react-server-dom-webpack/cjs/react-server-dom-webpack-client.browser.development.js:1329:22)
    at parseModelString (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@15.2.4_@babel+core@7.26.10_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/compiled/react-server-dom-webpack/cjs/react-server-dom-webpack-client.browser.development.js:1469:15)
    at Object.eval (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@15.2.4_@babel+core@7.26.10_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/compiled/react-server-dom-webpack/cjs/react-server-dom-webpack-client.browser.development.js:2274:18)
    at JSON.parse (<anonymous>)
    at initializeModelChunk (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@15.2.4_@babel+core@7.26.10_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/compiled/react-server-dom-webpack/cjs/react-server-dom-webpack-client.browser.development.js:1034:26)
    at ReactPromise.then (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@15.2.4_@babel+core@7.26.10_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/compiled/react-server-dom-webpack/cjs/react-server-dom-webpack-client.browser.development.js:2542:11)

---

_**Assistant**_



---

Okay, I see the error message: `Error: null value in column "language" of relation "decks" violates not-null constraint`.

This error is coming directly from your PostgreSQL database. It means that when attempting to create a new deck using the `createDeck` action (which likely calls `createDeckService` in `lib/deckService.ts`), the value being inserted into the `language` column was `NULL`. However, the database schema for the `decks` table has a `NOT NULL` constraint on the `language` column, forbidding `NULL` values.

Looking at the `createDeckService` function in `lib/deckService.ts`, the relevant part of the insert statement is:

```typescript
// ...
language: params.questionLanguage, // Keep for potential backward compatibility if needed
primary_language: params.questionLanguage,
secondary_language: params.answerLanguage,
// ...
```

This indicates that the `params.questionLanguage` value passed into `createDeckService` was likely `null` or `undefined`. While the `CreateDeckParams` interface defines `questionLanguage` as `string`, the runtime error shows that a `null` value still managed to get through.

**Possible Causes:**

1.  **Missing Upstream Validation:** The most likely cause is that the data passed from the frontend or the calling action (`createDeck` in `deckActions.ts`) didn't properly validate that `questionLanguage` had a valid string value before calling `createDeckService`.
2.  **Type Safety Issues:** Although TypeScript interfaces are used, there might be a point where type safety is lost (e.g., using `as any`, incorrect data fetching/parsing).

**Recommendations:**

1.  **Add Validation:** The best place to fix this is in the code *before* `createDeckService` is called (likely in `deckActions.ts` or the component that triggers the action). Ensure that `questionLanguage` is a non-empty string before proceeding.
2.  **Defensive Check (Optional):** As a safeguard, we could add a check inside `createDeckService` to explicitly handle `null` or empty string values for `questionLanguage` and return an error instead of attempting the database insert.

Since I don't have access to `deckActions.ts`, I'll add the defensive check within `createDeckService` for now.

```typescript
// Add this check at the beginning of createDeckService
export async function createDeckService(
  supabase: SupabaseClient,
  userId: string,
  params: CreateDeckParams
): Promise<{ data: Deck | null; error: PostgrestError | Error | null }> {
  // --- Add Defensive Check ---
  if (!params.questionLanguage) {
    console.error("createDeckService validation failed: questionLanguage is missing.");
    return { data: null, error: new Error("Question language cannot be empty.") };
  }
  // Ensure answerLanguage is also provided if bilingual
  if (params.isBilingual && !params.answerLanguage) {
     console.error("createDeckService validation failed: answerLanguage is missing for bilingual deck.");
     return { data: null, error: new Error("Answer language cannot be empty for bilingual decks.") };
  }
  // --- End Defensive Check ---

  const newDeckId = crypto.randomUUID(); // Generate ID client-side

  // ... rest of the function
```

**Addressing Linter Errors:**

I also notice several linter errors in `lib/deckService.ts` related to the `FlashCard` type. They all indicate that properties like `lastStudied` and `difficultyScore` are being assigned, but they don't exist on the `FlashCard` type definition (likely located in `@/types/deck.ts`).

To fix these, we need to ensure the `FlashCard` type definition matches the data structure being used. I'll need to see the definition in `@/types/deck.ts`.

Could you please provide the contents of `@/types/deck.ts`? Once I have that, I can fix the linter errors in `lib/deckService.ts` and apply the defensive check for the `language` column.

---



---

