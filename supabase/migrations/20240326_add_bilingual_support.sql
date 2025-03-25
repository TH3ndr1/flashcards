-- Add bilingual support columns to decks table
ALTER TABLE decks
ADD COLUMN is_bilingual boolean DEFAULT false,
ADD COLUMN question_language text DEFAULT 'en',
ADD COLUMN answer_language text DEFAULT 'en';

-- Update existing decks to use their current language for both question and answer
UPDATE decks
SET question_language = language,
    answer_language = language
WHERE language IS NOT NULL;

-- Add not null constraints after setting default values
ALTER TABLE decks
ALTER COLUMN question_language SET NOT NULL,
ALTER COLUMN answer_language SET NOT NULL,
ALTER COLUMN is_bilingual SET NOT NULL;

-- Add comment explaining the fields
COMMENT ON COLUMN decks.is_bilingual IS 'Whether the deck uses different languages for questions and answers';
COMMENT ON COLUMN decks.question_language IS 'Language used for questions';
COMMENT ON COLUMN decks.answer_language IS 'Language used for answers'; 