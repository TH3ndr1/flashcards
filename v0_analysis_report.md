# Technisch Analyserapport: v0 Flashcard Applicatie Logica & Patronen

**Rol:** Senior Software Architect
**Datum:** 2025-05-24
**Onderwerp:** Extractie van businesslogica en functionele patronen voor v1 transitie.

---

## 1. Domein Logica: Decks & Cards
De kernlogica voor het beheer van decks en kaarten bevindt zich in `lib/actions/cardActions.ts` en `lib/actions/deckActions.ts`.

### Gevonden Business Invariants
*   **Card Content Integrity:** Een kaart MOET een niet-lege `question` en `answer` hebben (gevalideerd via Zod).
*   **Deck-Card Constraint:** Een kaart kan alleen worden toegevoegd aan een deck dat de status `active` heeft.
*   **Ownership Isolation:** Elke operatie (CRUD) vereist een expliciete match tussen de `user_id` van de sessie en de `user_id` in de database rij.
*   **SRS Initialisatie:** Nieuwe kaarten starten verplicht met `srs_level: 0`, `easiness_factor: 2.5` en `interval_days: 0`.

### Bulk Operaties & Transacties
*   **Gedrag:** `createCardsBatch` voert een bulk-insert uit via Supabase. Hoewel de insert zelf atomisch is, ontbreekt een bredere transactionele context (bijv. bij het gelijktijdig aanmaken van een deck en kaarten).
*   **Risico:** In `mergeDecks` wordt atomisiteit handmatig gesimuleerd met rollback-logica in TypeScript. Bij falen van de laatste stap (verwijderen oude decks) kan de data in een inconsistente staat achterblijven. Dit is een "leaky abstraction" van databaseverantwoordelijkheden naar de applicatielaag.

### Soft Deletes
*   **Inconsistentie:** `deleteCard` en `deleteDeck` zijn **harde deletes** (`DELETE` statement). `archiveDeck` functioneert als een **soft delete** door de `status` kolom op `'archived'` te zetten voor zowel het deck als alle bijbehorende kaarten.

---

## 2. User Scoping & Data Isolatie

### Context Flow
*   **Propagatie:** De `userId` wordt niet via een globale context aan de database-laag doorgegeven, maar per functie-aanroep opgehaald uit de sessie (`supabase.auth.getUser()`).
*   **Explicit Filtering:** In vrijwel elke query wordt `.eq('user_id', user.id)` handmatig toegevoegd.

### Data Lekken & Risico's
*   **RLS Afhankelijkheid:** De applicatie vertrouwt sterk op Row Level Security (RLS) als tweede defensielaag (bevestigd door gebruik van de `Anon` key).
*   **Inconsistente Logica:** In `tagActions.ts` (bijv. `getCardTags`) wordt expliciete filtering soms weggelaten onder de aanname dat RLS het opvangt of dat de kolom ontbreekt (terwijl deze wel bestaat). Dit vormt een risico bij toekomstige migraties waarbij RLS mogelijk tijdelijk wordt uitgeschakeld of aangepast.

---

## 3. Spaced Repetition System (SRS) Logica
Gevestigd in `lib/srs.ts`. Dit is de "Single Source of Truth" voor het algoritme.

### Algoritme & Formules
*   **Easiness Factor (EF) Update:**
    `newEF = currentEF + (0.1 - (5 - (grade + 1)) * (0.08 + (5 - (grade + 1)) * 0.02))`
*   **Interval (I) Berekening (Review Phase):**
    *   I(1 -> 2): `Math.round(firstReviewBaseDays * multiplier)`
    *   I(n -> n+1): `Math.round(previousInterval * multiplier)`
    *   *Multiplier:* `1.2` bij Grade 2 (Hard), `newEF` bij Grade 3/4.
*   **Initial EF (Graduation):**
    `defaultEF - (failedAttempts * learnAgainPenalty) - (hardAttempts * learnHardPenalty)`

### States & Transities
*   **Learning:** Initiële fase. Graduatie naar `review` (level 1) na voltooiing van stappen of direct bij Grade 4.
*   **Review:** SM-2 fase (`level >= 1`). Bij Grade 1 (Again) vindt een **Lapse** plaats: transitie naar `relearning`, reset naar level 0, EF penalty.
*   **Relearning:** Post-lapse fase. Keert terug naar `review` op level 1 na voltooiing van de stappen.
*   **Triggers:** De `learning_step_index` bepaalt de positie in de geconfigureerde minuten-arrays (`initialLearningStepsMinutes` / `relearningStepsMinutes`).

---

## 4. Schema-on-Read & JSONB

### Validatie & Defaults
*   **Gedeeltelijke Validatie:** Alleen `study_sets.query_criteria` wordt strikt gevalideerd met Zod bij het inlezen.
*   **Schema-on-Read Risico:** Velden zoals `decks.progress` en `settings` worden als ruwe JSON objecten ingelezen. De code gebruikt overal optional chaining (`?.`) en ad-hoc defaults (`??`), wat duidt op een gebrek aan een robuust data-contract.
*   **Default Logica:** Defaults zijn verspreid over de codebase (providers, utils, actions) in plaats van gecentraliseerd bij de data-access laag.

---

## 5. Error Handling & Logging

### Error Taxonomy
*   **ActionResult Patroon:** De codebase gebruikt consistent `{ data, error }` objecten.
*   **Gebrek aan Typificatie:** Fouten zijn bijna altijd platte strings (`error.message`). Er is geen gebruik van specifieke foutklassen of error codes om onderscheid te maken tussen autorisatiefouten en validatiefouten, behalve door string-matching.

### Observability
*   **Logging:** Gebruik van `loglevel` (app) en `pino` (status). Logs bevatten contextuele ID's (`deckId`, `userId`) wat debugging in productie vergemakkelijkt.
*   **Leaky Errors:** Ruwe database-fouten worden vaak direct doorgegeven aan de `ActionResult`, wat technische details kan lekken naar de frontend.

---

## 6. AI & Externe Integraties

### AI Orchestratie (useAiGenerate.ts)
1.  **Extractie (Step 1):** OCR en initiële generatie. De server stuurt de *volledige* geëxtraheerde tekst terug naar de client.
2.  **Refinement (Step 2):** Voor classificatie of regeneratie (Force Knowledge) stuurt de client de data (inclusief de volledige tekst) weer terug naar de server.
3.  **Checkpoints:** Er zijn **geen database-checkpoints**. Het gehele proces is in-memory in de browser.

### Verborgen Restricties
*   **Fragiliteit:** De voortgang is volledig afhankelijk van de React-state. Bij een page-refresh of crash van de browser moet het proces (OCR en AI-calls) volledig opnieuw worden gestart. Er is geen persistentie tussen de AI-stappen.
*   **Data Overhead:** Het heen-en-weer sturen van grote tekstblokken tussen client en server is inefficiënt en vergroot de kans op netwerkfouten bij grote bestanden.

---

## Conclusie voor v1
De v0 codebase bevat waardevolle SRS-logica en stabiele data-contracten voor kaarten, maar lijdt aan **architecturale drift** (mix van hard/soft deletes) en **fragiele AI-orchestratie**.

**Geadviseerde focus voor v1:**
1.  Centraliseer SRS-logica in een `SRS-Policy` laag.
2.  Implementeer het "Stateful Job" patroon voor AI om browser-afhankelijkheid te elimineren.
3.  Uniformeer soft-deletes via een `deleted_at` kolom.
4.  Dwing "Server-Side Schema on Read" af via Zod-validatie voor alle JSONB velden.
