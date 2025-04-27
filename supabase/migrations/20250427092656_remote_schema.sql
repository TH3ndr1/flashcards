create type "public"."font_option" as enum ('default', 'opendyslexic', 'atkinson');

create table "public"."cards" (
    "id" uuid not null default uuid_generate_v4(),
    "deck_id" uuid not null,
    "question" text not null,
    "answer" text not null,
    "correct_count" integer default 0,
    "incorrect_count" integer default 0,
    "last_studied" timestamp with time zone,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone default timezone('utc'::text, now()),
    "attempt_count" integer default 0,
    "difficulty_score" double precision default 0,
    "user_id" uuid,
    "last_reviewed_at" timestamp with time zone,
    "next_review_due" timestamp with time zone,
    "srs_level" integer not null default 0,
    "easiness_factor" double precision default 2.5,
    "interval_days" integer default 0,
    "stability" double precision,
    "difficulty" double precision,
    "last_review_grade" integer,
    "question_part_of_speech" text default 'N/A'::text,
    "question_gender" text default 'N/A'::text,
    "answer_part_of_speech" text default 'N/A'::text,
    "answer_gender" text default 'N/A'::text
);


alter table "public"."cards" enable row level security;

create table "public"."deck_tags" (
    "deck_id" uuid not null,
    "tag_id" uuid not null,
    "user_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."deck_tags" enable row level security;

create table "public"."decks" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "name" text not null,
    "progress" jsonb not null default '{"streak": 0, "correct": 0, "incorrect": 0, "lastStudied": null}'::jsonb,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone default timezone('utc'::text, now()),
    "is_bilingual" boolean not null default false,
    "primary_language" text not null default 'en'::text,
    "secondary_language" text not null default 'en'::text
);


alter table "public"."decks" enable row level security;

create table "public"."settings" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "app_language" text not null default 'english'::text,
    "preferred_voices" jsonb not null default '{"dutch": null, "french": null, "english": null}'::jsonb,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone default timezone('utc'::text, now()),
    "language_dialects" jsonb default jsonb_build_object('en', 'en-GB', 'nl', 'nl-NL', 'fr', 'fr-FR', 'de', 'de-DE', 'es', 'es-ES', 'it', 'it-IT'),
    "tts_enabled" boolean default true,
    "show_difficulty" boolean default true,
    "mastery_threshold" integer default 3,
    "card_font" character varying(20) default 'default'::character varying,
    "enable_word_color_coding" boolean default false,
    "enable_basic_color_coding" boolean default true,
    "enable_advanced_color_coding" boolean default false,
    "word_palette_config" jsonb,
    "color_only_non_native" boolean default true
);


alter table "public"."settings" enable row level security;

create table "public"."study_sets" (
    "id" uuid not null default uuid_generate_v4(),
    "user_id" uuid not null,
    "name" text not null,
    "description" text,
    "query_criteria" jsonb not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."study_sets" enable row level security;

create table "public"."tags" (
    "id" uuid not null default uuid_generate_v4(),
    "user_id" uuid not null,
    "name" text not null,
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."tags" enable row level security;

CREATE UNIQUE INDEX cards_pkey ON public.cards USING btree (id);

CREATE UNIQUE INDEX deck_tags_pkey ON public.deck_tags USING btree (deck_id, tag_id);

CREATE UNIQUE INDEX decks_pkey ON public.decks USING btree (id);

CREATE INDEX idx_cards_deck_id ON public.cards USING btree (deck_id);

CREATE INDEX idx_cards_user_id_next_review_due ON public.cards USING btree (user_id, next_review_due);

CREATE INDEX idx_deck_tags_deck_id ON public.deck_tags USING btree (deck_id);

CREATE INDEX idx_deck_tags_tag_id ON public.deck_tags USING btree (tag_id);

CREATE INDEX idx_deck_tags_user_id ON public.deck_tags USING btree (user_id);

CREATE INDEX idx_decks_user_id ON public.decks USING btree (user_id);

CREATE INDEX idx_settings_user_id ON public.settings USING btree (user_id);

CREATE UNIQUE INDEX settings_pkey ON public.settings USING btree (id);

CREATE UNIQUE INDEX study_sets_pkey ON public.study_sets USING btree (id);

CREATE UNIQUE INDEX tags_pkey ON public.tags USING btree (id);

CREATE UNIQUE INDEX tags_user_id_name_key ON public.tags USING btree (user_id, name);

CREATE UNIQUE INDEX unique_user_settings ON public.settings USING btree (user_id);

alter table "public"."cards" add constraint "cards_pkey" PRIMARY KEY using index "cards_pkey";

alter table "public"."deck_tags" add constraint "deck_tags_pkey" PRIMARY KEY using index "deck_tags_pkey";

alter table "public"."decks" add constraint "decks_pkey" PRIMARY KEY using index "decks_pkey";

alter table "public"."settings" add constraint "settings_pkey" PRIMARY KEY using index "settings_pkey";

alter table "public"."study_sets" add constraint "study_sets_pkey" PRIMARY KEY using index "study_sets_pkey";

alter table "public"."tags" add constraint "tags_pkey" PRIMARY KEY using index "tags_pkey";

alter table "public"."cards" add constraint "cards_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."cards" validate constraint "cards_user_id_fkey";

alter table "public"."cards" add constraint "fk_deck" FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE not valid;

alter table "public"."cards" validate constraint "fk_deck";

alter table "public"."deck_tags" add constraint "deck_tags_deck_id_fkey" FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE not valid;

alter table "public"."deck_tags" validate constraint "deck_tags_deck_id_fkey";

alter table "public"."deck_tags" add constraint "deck_tags_tag_id_fkey" FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE not valid;

alter table "public"."deck_tags" validate constraint "deck_tags_tag_id_fkey";

alter table "public"."deck_tags" add constraint "deck_tags_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."deck_tags" validate constraint "deck_tags_user_id_fkey";

alter table "public"."decks" add constraint "fk_user" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."decks" validate constraint "fk_user";

alter table "public"."settings" add constraint "settings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."settings" validate constraint "settings_user_id_fkey";

alter table "public"."settings" add constraint "unique_user_settings" UNIQUE using index "unique_user_settings";

alter table "public"."study_sets" add constraint "study_sets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."study_sets" validate constraint "study_sets_user_id_fkey";

alter table "public"."tags" add constraint "tags_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."tags" validate constraint "tags_user_id_fkey";

alter table "public"."tags" add constraint "tags_user_id_name_key" UNIQUE using index "tags_user_id_name_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.resolve_study_query(p_user_id uuid, p_query_criteria jsonb, p_order_by_field text DEFAULT 'created_at'::text, p_order_by_direction text DEFAULT 'DESC'::text)
 RETURNS TABLE(card_id uuid)
 LANGUAGE plpgsql
AS $function$DECLARE
    v_sql                  TEXT;
    v_from_clause          TEXT := 'FROM cards c';
    v_where_clauses        TEXT[] := ARRAY[]::TEXT[];
    v_params               TEXT[] := ARRAY[]::TEXT[];
    v_param_index          INTEGER := 0;

    -- Parsed criteria variables
    v_deck_id              UUID;
    v_all_cards            BOOLEAN;
    v_include_tags         UUID[];
    v_exclude_tags         UUID[];
    v_tag_logic            TEXT;
    v_deck_title_contains  TEXT;
    v_deck_languages_raw   JSONB;
    v_deck_languages       TEXT[];
    v_created_date_filter  JSONB;
    v_updated_date_filter  JSONB;
    v_last_reviewed_filter JSONB;
    v_next_review_due_filter JSONB;
    v_srs_level_filter     JSONB;
    v_date_operator        TEXT;
    v_date_value_days      INTEGER;
    v_date_value_start     TEXT;
    v_date_value_end       TEXT;
    v_srs_operator         TEXT;
    v_srs_value            INTEGER;
    v_include_difficult    BOOLEAN; -- **[ADDED]**

    -- Ordering variables
    v_order_by_clause      TEXT;
    v_valid_order_field    TEXT;
    v_valid_order_direction TEXT;
    -- ** Use current schema column names, not front_content/back_content **
    v_allowed_order_fields TEXT[] := ARRAY[
        'created_at','updated_at','question','answer', -- Updated field names
        'last_reviewed_at','next_review_due','srs_level',
        'easiness_factor','interval_days','stability','difficulty'
    ];
    v_allowed_directions   TEXT[] := ARRAY['ASC','DESC'];
BEGIN
    RAISE NOTICE '[DEBUG resolve_study_query V4+Diff] START - User: %, Criteria: %', p_user_id, p_query_criteria;

    -- 0. Mandatory user_id filter
    v_where_clauses := array_append(
        v_where_clauses,
        format('c.user_id = %L::uuid', p_user_id)
    );
    RAISE NOTICE '[DEBUG V4+Diff] Added user_id clause';

    -- 1. allCards flag
    v_all_cards := (p_query_criteria->>'allCards')::BOOLEAN;
    IF v_all_cards IS TRUE THEN
        RAISE NOTICE '[DEBUG V4+Diff] allCards = true, skipping filters';
    ELSE
        RAISE NOTICE '[DEBUG V4+Diff] allCards = false, applying filters';

        -- 2. Deck filter (Literal embedding - unchanged from V4)
        v_deck_id := (p_query_criteria->>'deckId')::UUID;
        IF v_deck_id IS NOT NULL THEN
            v_where_clauses := array_append(
                v_where_clauses,
                format('c.deck_id = %L::uuid', v_deck_id)
            );
            RAISE NOTICE '[DEBUG V4+Diff] Added deck_id clause (%)', v_deck_id;
        END IF;

        -- 3. Deck Title / Language Filters (JOIN needed, unchanged from V4)
        v_deck_title_contains := p_query_criteria->>'deckTitleContains';
        v_deck_languages_raw  := p_query_criteria->'deckLanguages';
        IF v_deck_title_contains IS NOT NULL
           OR (v_deck_languages_raw IS NOT NULL
               AND jsonb_typeof(v_deck_languages_raw) = 'array'
               AND jsonb_array_length(v_deck_languages_raw) > 0) THEN
            RAISE NOTICE '[DEBUG V4+Diff] Adding JOIN decks';
            v_from_clause := v_from_clause || ' JOIN decks d ON c.deck_id = d.id';
            IF v_deck_title_contains IS NOT NULL THEN
                v_param_index := v_param_index + 1;
                v_where_clauses := array_append(v_where_clauses, format('d.title ILIKE $%s', v_param_index));
                v_params := array_append(v_params, ('%' || v_deck_title_contains || '%')::TEXT);
                RAISE NOTICE '[DEBUG V4+Diff] Added param $%: deckTitleContains', v_param_index;
            END IF;
            IF v_deck_languages_raw IS NOT NULL AND jsonb_typeof(v_deck_languages_raw) = 'array' AND jsonb_array_length(v_deck_languages_raw) > 0 THEN
                SELECT array_agg(elem::TEXT) INTO v_deck_languages FROM jsonb_array_elements_text(v_deck_languages_raw) AS elem;
                v_param_index := v_param_index + 1;
                v_where_clauses := array_append(v_where_clauses, format('(d.primary_language = ANY($%s::text[]) OR d.secondary_language = ANY($%s::text[]))', v_param_index, v_param_index));
                v_params := array_append(v_params, v_deck_languages::TEXT);
                RAISE NOTICE '[DEBUG V4+Diff] Added param $%: deckLanguages', v_param_index;
            END IF;
        END IF;

        -- 4. Tag filtering (Refactored for deck_tags)
        v_tag_logic := COALESCE(p_query_criteria->>'tagLogic','ANY'); -- 'ANY' or 'ALL'

        -- Include Tags Logic
        IF (p_query_criteria->'includeTags') IS NOT NULL AND jsonb_typeof(p_query_criteria->'includeTags') = 'array' AND jsonb_array_length(p_query_criteria->'includeTags') > 0 THEN
            SELECT array_agg(elem::TEXT::UUID) INTO v_include_tags FROM jsonb_array_elements_text(p_query_criteria->'includeTags') AS elem;
            v_param_index := v_param_index + 1;
            RAISE NOTICE '[DEBUG V4+Diff] includeTags (Deck Level) param index $%', v_param_index;

            IF v_tag_logic = 'ALL' THEN
                 -- Deck must have ALL the specified tags
                 v_where_clauses := array_append(v_where_clauses, format(
                    'c.deck_id IN (SELECT dt.deck_id FROM deck_tags dt WHERE dt.user_id = %L::uuid AND dt.tag_id = ANY($%s::uuid[]) GROUP BY dt.deck_id HAVING count(DISTINCT dt.tag_id) = %s)',
                    p_user_id,
                    v_param_index,
                    array_length(v_include_tags,1)
                 ));
                 RAISE NOTICE '[DEBUG V4+Diff] Added deck_tags includeTags (ALL) clause';
            ELSE -- ANY (Default)
                -- Deck must have AT LEAST ONE of the specified tags
                v_where_clauses := array_append(v_where_clauses, format(
                    'c.deck_id IN (SELECT DISTINCT dt.deck_id FROM deck_tags dt WHERE dt.user_id = %L::uuid AND dt.tag_id = ANY($%s::uuid[]))',
                    p_user_id,
                    v_param_index
                ));
                 RAISE NOTICE '[DEBUG V4+Diff] Added deck_tags includeTags (ANY) clause';
            END IF;

            v_params := array_append(v_params, v_include_tags::TEXT); -- Pass UUID array as text for parameter binding
            RAISE NOTICE '[DEBUG V4+Diff] Added includeTags param $% value: %', v_param_index, v_include_tags;
        END IF;

        -- Exclude Tags Logic
        IF (p_query_criteria->'excludeTags') IS NOT NULL AND jsonb_typeof(p_query_criteria->'excludeTags') = 'array' AND jsonb_array_length(p_query_criteria->'excludeTags') > 0 THEN
            SELECT array_agg(elem::TEXT::UUID) INTO v_exclude_tags FROM jsonb_array_elements_text(p_query_criteria->'excludeTags') AS elem;
            v_param_index := v_param_index + 1;
            RAISE NOTICE '[DEBUG V4+Diff] excludeTags (Deck Level) param index $%', v_param_index;

            -- Deck must NOT have ANY of the specified tags
            v_where_clauses := array_append(v_where_clauses, format(
                'c.deck_id NOT IN (SELECT DISTINCT dt.deck_id FROM deck_tags dt WHERE dt.user_id = %L::uuid AND dt.tag_id = ANY($%s::uuid[]))',
                 p_user_id,
                 v_param_index
            ));
            v_params := array_append(v_params, v_exclude_tags::TEXT); -- Pass UUID array as text
            RAISE NOTICE '[DEBUG V4+Diff] Added excludeTags param $% value: %', v_param_index, v_exclude_tags;
        END IF;
        -- End Refactored Tag Filtering

        -- 5. Date/Timestamp Filters (Partial logic from V4 - assumes other dates were similar)
        v_created_date_filter := p_query_criteria->'createdDate';
        IF v_created_date_filter IS NOT NULL AND jsonb_typeof(v_created_date_filter) = 'object' THEN
            v_date_operator := v_created_date_filter->>'operator';
            RAISE NOTICE '[DEBUG V4+Diff] Processing createdDate filter, operator: %', v_date_operator;
            IF v_date_operator = 'newerThanDays' THEN v_date_value_days := (v_created_date_filter->>'value')::INT; v_where_clauses := array_append(v_where_clauses, format('c.created_at >= (NOW() - interval ''%s day'')', v_date_value_days));
            ELSIF v_date_operator = 'olderThanDays' THEN v_date_value_days := (v_created_date_filter->>'value')::INT; v_where_clauses := array_append(v_where_clauses, format('c.created_at < (NOW() - interval ''%s day'')', v_date_value_days));
            ELSIF v_date_operator = 'onDate' THEN v_date_value_start := v_created_date_filter->>'value'; v_param_index := v_param_index + 1; v_where_clauses := array_append(v_where_clauses, format('c.created_at::date = $%s::date', v_param_index)); v_params := array_append(v_params, v_date_value_start);
            ELSIF v_date_operator = 'betweenDates' THEN v_date_value_start := v_created_date_filter->'value'->>0; v_date_value_end := v_created_date_filter->'value'->>1; IF v_date_value_start IS NOT NULL AND v_date_value_end IS NOT NULL THEN v_param_index := v_param_index + 1; v_where_clauses := array_append(v_where_clauses, format('c.created_at >= $%s::timestamptz', v_param_index)); v_params := array_append(v_params, v_date_value_start); v_param_index := v_param_index + 1; v_where_clauses := array_append(v_where_clauses, format('c.created_at <= $%s::timestamptz', v_param_index)); v_params := array_append(v_params, v_date_value_end); END IF;
            END IF;
        END IF;
        -- *** Add similar IF blocks here for updatedDate, lastReviewed, nextReviewDue ***
        -- *** based on your original V4 code if they existed and used parameters ***

        -- 6. SRS level filter (Unchanged from V4)
        v_srs_level_filter := p_query_criteria->'srsLevel';
        IF v_srs_level_filter IS NOT NULL AND jsonb_typeof(v_srs_level_filter) = 'object' THEN
            v_srs_operator := v_srs_level_filter->>'operator';
            v_srs_value    := (v_srs_level_filter->>'value')::INT;
            RAISE NOTICE '[DEBUG V4+Diff] Processing srsLevel filter, op: %, val: %', v_srs_operator, v_srs_value;
            IF v_srs_value IS NOT NULL THEN
                IF v_srs_operator = 'equals' THEN v_where_clauses := array_append(v_where_clauses, format('c.srs_level = %s', v_srs_value));
                ELSIF v_srs_operator = 'lessThan' THEN v_where_clauses := array_append(v_where_clauses, format('c.srs_level < %s', v_srs_value));
                ELSIF v_srs_operator = 'greaterThan' THEN v_where_clauses := array_append(v_where_clauses, format('c.srs_level > %s', v_srs_value));
                END IF;
                 RAISE NOTICE '[DEBUG V4+Diff] Added srsLevel clause';
            END IF;
        END IF;

        -- 7. Difficult Filter **[NEW LOGIC ADDED HERE]**
        v_include_difficult := (p_query_criteria ->> 'includeDifficult')::boolean;
        IF v_include_difficult IS TRUE THEN
             RAISE NOTICE '[DEBUG V4+Diff] includeDifficult=true, adding clause';
             -- This clause uses only literals, no parameters, so safe to add
             v_where_clauses := array_append(v_where_clauses, '(c.srs_level < 3 OR c.last_review_grade IS NULL OR c.last_review_grade <= 2)');
        END IF;
        -- **[END NEW LOGIC]**

    END IF;  -- END allCards

    -- 8. Build ORDER BY (Unchanged from V4, but using updated allowed fields)
    v_valid_order_field     := COALESCE(p_order_by_field,'created_at');
    v_valid_order_direction := UPPER(COALESCE(p_order_by_direction,'DESC'));
    IF NOT v_valid_order_field = ANY(v_allowed_order_fields) THEN v_valid_order_field := 'created_at'; END IF;
    IF NOT v_valid_order_direction = ANY(v_allowed_directions) THEN v_valid_order_direction := 'DESC'; END IF;
    v_order_by_clause := format('ORDER BY c.%I %s NULLS LAST', v_valid_order_field, v_valid_order_direction);
    RAISE NOTICE '[DEBUG V4+Diff] Order By Clause: %', v_order_by_clause;

    -- 9. Final SQL & execution
    v_sql := 'SELECT c.id ' || v_from_clause || ' WHERE ' ||
             -- Handle case where only user_id filter exists
             (CASE WHEN array_length(v_where_clauses, 1) > 0 THEN array_to_string(v_where_clauses,' AND ') ELSE 'TRUE' END)
             || ' ' || v_order_by_clause;

    RAISE NOTICE '[FINAL V4+Diff] SQL: %', v_sql;
    RAISE NOTICE '[FINAL V4+Diff] PARAMS: %', v_params;

    -- Execute using original USING syntax, passing the params array
    RETURN QUERY EXECUTE v_sql USING v_params;

EXCEPTION
    WHEN others THEN
        RAISE WARNING '[ERROR V4+Diff] SQLSTATE: %, MSG: %', SQLSTATE, SQLERRM;
        RAISE WARNING '[FAILED SQL V4+Diff] %', v_sql;
        RAISE WARNING '[FAILED PARAMS V4+Diff] %', v_params;
        RETURN;
END;$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

grant delete on table "public"."cards" to "anon";

grant insert on table "public"."cards" to "anon";

grant references on table "public"."cards" to "anon";

grant select on table "public"."cards" to "anon";

grant trigger on table "public"."cards" to "anon";

grant truncate on table "public"."cards" to "anon";

grant update on table "public"."cards" to "anon";

grant delete on table "public"."cards" to "authenticated";

grant insert on table "public"."cards" to "authenticated";

grant references on table "public"."cards" to "authenticated";

grant select on table "public"."cards" to "authenticated";

grant trigger on table "public"."cards" to "authenticated";

grant truncate on table "public"."cards" to "authenticated";

grant update on table "public"."cards" to "authenticated";

grant delete on table "public"."cards" to "service_role";

grant insert on table "public"."cards" to "service_role";

grant references on table "public"."cards" to "service_role";

grant select on table "public"."cards" to "service_role";

grant trigger on table "public"."cards" to "service_role";

grant truncate on table "public"."cards" to "service_role";

grant update on table "public"."cards" to "service_role";

grant delete on table "public"."deck_tags" to "anon";

grant insert on table "public"."deck_tags" to "anon";

grant references on table "public"."deck_tags" to "anon";

grant select on table "public"."deck_tags" to "anon";

grant trigger on table "public"."deck_tags" to "anon";

grant truncate on table "public"."deck_tags" to "anon";

grant update on table "public"."deck_tags" to "anon";

grant delete on table "public"."deck_tags" to "authenticated";

grant insert on table "public"."deck_tags" to "authenticated";

grant references on table "public"."deck_tags" to "authenticated";

grant select on table "public"."deck_tags" to "authenticated";

grant trigger on table "public"."deck_tags" to "authenticated";

grant truncate on table "public"."deck_tags" to "authenticated";

grant update on table "public"."deck_tags" to "authenticated";

grant delete on table "public"."deck_tags" to "service_role";

grant insert on table "public"."deck_tags" to "service_role";

grant references on table "public"."deck_tags" to "service_role";

grant select on table "public"."deck_tags" to "service_role";

grant trigger on table "public"."deck_tags" to "service_role";

grant truncate on table "public"."deck_tags" to "service_role";

grant update on table "public"."deck_tags" to "service_role";

grant delete on table "public"."decks" to "anon";

grant insert on table "public"."decks" to "anon";

grant references on table "public"."decks" to "anon";

grant select on table "public"."decks" to "anon";

grant trigger on table "public"."decks" to "anon";

grant truncate on table "public"."decks" to "anon";

grant update on table "public"."decks" to "anon";

grant delete on table "public"."decks" to "authenticated";

grant insert on table "public"."decks" to "authenticated";

grant references on table "public"."decks" to "authenticated";

grant select on table "public"."decks" to "authenticated";

grant trigger on table "public"."decks" to "authenticated";

grant truncate on table "public"."decks" to "authenticated";

grant update on table "public"."decks" to "authenticated";

grant delete on table "public"."decks" to "service_role";

grant insert on table "public"."decks" to "service_role";

grant references on table "public"."decks" to "service_role";

grant select on table "public"."decks" to "service_role";

grant trigger on table "public"."decks" to "service_role";

grant truncate on table "public"."decks" to "service_role";

grant update on table "public"."decks" to "service_role";

grant delete on table "public"."settings" to "anon";

grant insert on table "public"."settings" to "anon";

grant references on table "public"."settings" to "anon";

grant select on table "public"."settings" to "anon";

grant trigger on table "public"."settings" to "anon";

grant truncate on table "public"."settings" to "anon";

grant update on table "public"."settings" to "anon";

grant delete on table "public"."settings" to "authenticated";

grant insert on table "public"."settings" to "authenticated";

grant references on table "public"."settings" to "authenticated";

grant select on table "public"."settings" to "authenticated";

grant trigger on table "public"."settings" to "authenticated";

grant truncate on table "public"."settings" to "authenticated";

grant update on table "public"."settings" to "authenticated";

grant delete on table "public"."settings" to "service_role";

grant insert on table "public"."settings" to "service_role";

grant references on table "public"."settings" to "service_role";

grant select on table "public"."settings" to "service_role";

grant trigger on table "public"."settings" to "service_role";

grant truncate on table "public"."settings" to "service_role";

grant update on table "public"."settings" to "service_role";

grant delete on table "public"."study_sets" to "anon";

grant insert on table "public"."study_sets" to "anon";

grant references on table "public"."study_sets" to "anon";

grant select on table "public"."study_sets" to "anon";

grant trigger on table "public"."study_sets" to "anon";

grant truncate on table "public"."study_sets" to "anon";

grant update on table "public"."study_sets" to "anon";

grant delete on table "public"."study_sets" to "authenticated";

grant insert on table "public"."study_sets" to "authenticated";

grant references on table "public"."study_sets" to "authenticated";

grant select on table "public"."study_sets" to "authenticated";

grant trigger on table "public"."study_sets" to "authenticated";

grant truncate on table "public"."study_sets" to "authenticated";

grant update on table "public"."study_sets" to "authenticated";

grant delete on table "public"."study_sets" to "service_role";

grant insert on table "public"."study_sets" to "service_role";

grant references on table "public"."study_sets" to "service_role";

grant select on table "public"."study_sets" to "service_role";

grant trigger on table "public"."study_sets" to "service_role";

grant truncate on table "public"."study_sets" to "service_role";

grant update on table "public"."study_sets" to "service_role";

grant delete on table "public"."tags" to "anon";

grant insert on table "public"."tags" to "anon";

grant references on table "public"."tags" to "anon";

grant select on table "public"."tags" to "anon";

grant trigger on table "public"."tags" to "anon";

grant truncate on table "public"."tags" to "anon";

grant update on table "public"."tags" to "anon";

grant delete on table "public"."tags" to "authenticated";

grant insert on table "public"."tags" to "authenticated";

grant references on table "public"."tags" to "authenticated";

grant select on table "public"."tags" to "authenticated";

grant trigger on table "public"."tags" to "authenticated";

grant truncate on table "public"."tags" to "authenticated";

grant update on table "public"."tags" to "authenticated";

grant delete on table "public"."tags" to "service_role";

grant insert on table "public"."tags" to "service_role";

grant references on table "public"."tags" to "service_role";

grant select on table "public"."tags" to "service_role";

grant trigger on table "public"."tags" to "service_role";

grant truncate on table "public"."tags" to "service_role";

grant update on table "public"."tags" to "service_role";

create policy "Users can only access cards in their decks"
on "public"."cards"
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM decks
  WHERE ((decks.id = cards.deck_id) AND (decks.user_id = auth.uid())))));


create policy "Allow users to DELETE their own deck_tags"
on "public"."deck_tags"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Allow users to INSERT deck_tags for their own decks"
on "public"."deck_tags"
as permissive
for insert
to public
with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM decks
  WHERE ((decks.id = deck_tags.deck_id) AND (decks.user_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM tags
  WHERE ((tags.id = deck_tags.tag_id) AND (tags.user_id = auth.uid()))))));


create policy "Allow users to SELECT their own deck_tags"
on "public"."deck_tags"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Users can only access their own decks"
on "public"."decks"
as permissive
for all
to public
using ((auth.uid() = user_id));


create policy "Allow individual user access to their settings"
on "public"."settings"
as permissive
for all
to public
using ((auth.uid() = user_id));


create policy "Users can only access their own settings"
on "public"."settings"
as permissive
for all
to public
using ((auth.uid() = user_id));


create policy "Allow individual user access to their study_sets"
on "public"."study_sets"
as permissive
for all
to public
using ((auth.uid() = user_id));


create policy "Allow individual user access to their tags"
on "public"."tags"
as permissive
for all
to public
using ((auth.uid() = user_id));


CREATE TRIGGER set_cards_updated_at BEFORE UPDATE ON public.cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_study_sets_updated_at BEFORE UPDATE ON public.study_sets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


