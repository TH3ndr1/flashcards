-- Update existing language values to use ISO codes
UPDATE decks
SET language = CASE language
    WHEN 'english' THEN 'en'
    WHEN 'dutch' THEN 'nl'
    WHEN 'french' THEN 'fr'
    ELSE language
END,
question_language = CASE question_language
    WHEN 'english' THEN 'en'
    WHEN 'dutch' THEN 'nl'
    WHEN 'french' THEN 'fr'
    ELSE question_language
END,
answer_language = CASE answer_language
    WHEN 'english' THEN 'en'
    WHEN 'dutch' THEN 'nl'
    WHEN 'french' THEN 'fr'
    ELSE answer_language
END; 