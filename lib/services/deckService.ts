/**
 * Deck Service
 * 
 * This service provides a comprehensive set of methods for managing decks and cards in the application.
 * It handles all CRUD operations for decks and cards, as well as specialized operations like:
 * - Deck statistics and analytics
 * - Card review scheduling
 * - Study set management
 * - Card search and filtering
 * 
 * The service is designed to work with both local storage (for offline support) and the backend API.
 * It implements caching strategies to optimize performance and reduce server load.
 * 
 * @module deckService
 * @example
 * // Create a new deck
 * const deck = await deckService.createDeck({
 *   name: 'My Deck',
 *   description: 'A collection of cards'
 * });
 * 
 * // Add cards to a deck
 * await deckService.addCards(deck.id, [
 *   { front: 'Question', back: 'Answer' }
 * ]);
 * 
 * // Get deck statistics
 * const stats = await deckService.getDeckStats(deck.id);
 */
/**
 * Represents a deck of flashcards.
 * 
 * A deck is a collection of flashcards that can be reviewed together.
 * It contains metadata about the deck, its settings, and statistics.
 * 
 * @interface Deck
 * @property {string} id - Unique identifier for the deck
 * @property {string} name - Name of the deck
 * @property {string} description - Description of the deck
 * @property {string[]} tags - Tags associated with the deck
 * @property {string} [coverImage] - URL of the deck's cover image
 * @property {string} [color] - Color theme for the deck
 * @property {boolean} isPublic - Whether the deck is publicly visible
 * @property {boolean} isArchived - Whether the deck is archived
 * @property {string} [parentId] - ID of the parent deck if this is a subdeck
 * @property {string} ownerId - ID of the user who owns the deck
 * @property {string} [sharedWith] - IDs of users the deck is shared with
 * @property {DeckSettings} settings - Configuration settings for the deck
 * @property {DeckStats} stats - Statistics about the deck's usage
 * @property {Date} createdAt - When the deck was created
 * @property {Date} updatedAt - When the deck was last updated
 * @property {Date} [lastReviewed] - When the deck was last reviewed
 * @property {number} [version] - Version number of the deck
 * @property {string} [language] - Primary language of the deck
 * @property {string} [sourceLanguage] - Source language for translations
 * @property {string} [targetLanguage] - Target language for translations
 * @property {string} [category] - Category of the deck
 * @property {string} [subcategory] - Subcategory of the deck
 * @property {string} [level] - Difficulty level of the deck
 * @property {string} [author] - Author of the deck
 * @property {string} [license] - License of the deck
 * @property {string} [attribution] - Attribution information
 * @property {string} [source] - Source of the deck content
 * @property {string} [notes] - Additional notes about the deck
 * @property {string[]} [prerequisites] - IDs of prerequisite decks
 * @property {string[]} [relatedDecks] - IDs of related decks
 * @property {string[]} [recommendedDecks] - IDs of recommended decks
 * @property {string[]} [requiredDecks] - IDs of required decks
 * @property {string[]} [optionalDecks] - IDs of optional decks
 * @property {string[]} [excludedDecks] - IDs of excluded decks
 * @property {string[]} [includedDecks] - IDs of included decks
 * @property {string[]} [compatibleDecks] - IDs of compatible decks
 * @property {string[]} [incompatibleDecks] - IDs of incompatible decks
 * @property {string[]} [similarDecks] - IDs of similar decks
 * @property {string[]} [alternativeDecks] - IDs of alternative decks
 * @property {string[]} [complementaryDecks] - IDs of complementary decks
 * @property {string[]} [supplementaryDecks] - IDs of supplementary decks
 * @property {string[]} [prerequisiteDecks] - IDs of prerequisite decks
 * @property {string[]} [corequisiteDecks] - IDs of corequisite decks
 * @property {string[]} [postrequisiteDecks] - IDs of postrequisite decks
 * @property {string[]} [antirequisiteDecks] - IDs of antirequisite decks
 * @property {string[]} [coantirequisiteDecks] - IDs of coantirequisite decks
 * @property {string[]} [preantirequisiteDecks] - IDs of preantirequisite decks
 * @property {string[]} [postantirequisiteDecks] - IDs of postantirequisite decks
 * @property {string[]} [corequisiteDecks] - IDs of corequisite decks
 * @property {string[]} [prerequisiteDecks] - IDs of prerequisite decks
 * @property {string[]} [postrequisiteDecks] - IDs of postrequisite decks
 * @property {string[]} [antirequisiteDecks] - IDs of antirequisite decks
 * @property {string[]} [coantirequisiteDecks] - IDs of coantirequisite decks
 * @property {string[]} [preantirequisiteDecks] - IDs of preantirequisite decks
 * @property {string[]} [postantirequisiteDecks] - IDs of postantirequisite decks
 */
export interface Deck {
  // ... existing code ...
}

/**
 * Represents detailed statistics about a deck's performance.
 * 
 * This interface provides comprehensive metrics for tracking learning progress,
 * including success rates, review patterns, and mastery levels.
 * 
 * @interface DeckStats
 * @property {number} totalReviews - Total number of review attempts
 * @property {number} correctReviews - Number of successful reviews
 * @property {number} incorrectReviews - Number of failed reviews
 * @property {number} successRate - Percentage of correct reviews (0-100)
 * @property {number} averageTimePerCard - Average time spent per card in milliseconds
 * @property {number} streak - Current streak of successful reviews
 * @property {number} longestStreak - Longest streak of successful reviews
 * @property {Date} lastReviewDate - Date of the most recent review
 * @property {number} cardsMastered - Number of cards marked as mastered
 * @property {number} cardsLearning - Number of cards currently being learned
 * @property {number} cardsNew - Number of new cards not yet reviewed
 * @property {number} cardsDue - Number of cards due for review
 * @property {number} cardsOverdue - Number of cards past their review date
 * @property {number} averageInterval - Average time between reviews in days
 * @property {number} estimatedTimeToMaster - Estimated time to master all cards in days
 * @property {Record<string, number>} [tagStats] - Statistics grouped by card tags
 * @property {Record<string, number>} [difficultyStats] - Statistics grouped by card difficulty
 * @property {Date} [firstReviewDate] - Date of the first review
 * @property {number} [totalStudyTime] - Total time spent studying in milliseconds
 * @property {number} [reviewAccuracy] - Overall accuracy of reviews (0-100)
 * @property {number} [retentionRate] - Long-term retention rate (0-100)
 */
export interface DeckStats {
  // ... existing code ...
}

/**
 * Represents customizable settings for a deck.
 * 
 * This interface allows users to configure various aspects of how cards in a deck
 * are presented, reviewed, and managed.
 * 
 * @interface DeckSettings
 * @property {number} newCardsPerDay - Maximum number of new cards to introduce daily
 * @property {number} reviewCardsPerDay - Maximum number of review cards per day
 * @property {number} maxInterval - Maximum interval between reviews in days
 * @property {number} minInterval - Minimum interval between reviews in days
 * @property {number} easeFactor - Multiplier for interval calculations
 * @property {number} lapseThreshold - Number of failures before card is marked as lapsed
 * @property {number} lapsePenalty - Percentage to reduce interval after a lapse
 * @property {boolean} buryRelated - Whether to bury related cards until next day
 * @property {boolean} showAnswerAfter - Whether to show answer after each card
 * @property {number} answerTimeLimit - Time limit for answering in seconds
 * @property {string} [defaultFrontTemplate] - Default template for card fronts
 * @property {string} [defaultBackTemplate] - Default template for card backs
 * @property {string[]} [tags] - Default tags for new cards
 * @property {boolean} [randomizeOrder] - Whether to randomize card order
 * @property {number} [masteryThreshold] - Score required to mark a card as mastered
 * @property {number} [reviewLimit] - Maximum number of reviews per session
 * @property {boolean} [enableSpacedRepetition] - Whether to use spaced repetition
 * @property {number} [startingEase] - Initial ease factor for new cards
 * @property {number} [graduatingInterval] - Interval for graduating cards
 * @property {number} [easyInterval] - Interval for easy cards
 * @property {number} [hardInterval] - Interval for hard cards
 * @property {number} [minimumInterval] - Minimum interval between reviews
 * @property {number} [maximumInterval] - Maximum interval between reviews
 * @property {number} [newCardOrder] - Order for introducing new cards
 * @property {number} [reviewOrder] - Order for reviewing cards
 * @property {boolean} [showTimer] - Whether to show a timer during reviews
 * @property {boolean} [autoPlayAudio] - Whether to auto-play audio
 * @property {boolean} [autoAdvance] - Whether to auto-advance to next card
 * @property {number} [typingTolerance] - Tolerance for typing answers
 * @property {boolean} [caseSensitive] - Whether answers are case-sensitive
 * @property {boolean} [ignorePunctuation] - Whether to ignore punctuation
 * @property {boolean} [ignoreWhitespace] - Whether to ignore whitespace
 * @property {boolean} [ignoreAccents] - Whether to ignore accents
 * @property {boolean} [showHints] - Whether to show hints
 * @property {number} [hintDelay] - Delay before showing hints in seconds
 * @property {boolean} [showExamples] - Whether to show examples
 * @property {number} [exampleDelay] - Delay before showing examples in seconds
 * @property {boolean} [showNotes] - Whether to show notes
 * @property {number} [noteDelay] - Delay before showing notes in seconds
 * @property {boolean} [showTags] - Whether to show tags
 * @property {number} [tagDelay] - Delay before showing tags in seconds
 * @property {boolean} [showStats] - Whether to show statistics
 * @property {number} [statDelay] - Delay before showing statistics in seconds
 * @property {boolean} [showProgress] - Whether to show progress
 * @property {number} [progressDelay] - Delay before showing progress in seconds
 * @property {boolean} [showTimer] - Whether to show a timer
 * @property {number} [timerDelay] - Delay before showing timer in seconds
 * @property {boolean} [showScore] - Whether to show score
 * @property {number} [scoreDelay] - Delay before showing score in seconds
 * @property {boolean} [showFeedback] - Whether to show feedback
 * @property {number} [feedbackDelay] - Delay before showing feedback in seconds
 * @property {boolean} [showAnswer] - Whether to show answer
 * @property {number} [answerDelay] - Delay before showing answer in seconds
 * @property {boolean} [showQuestion] - Whether to show question
 * @property {number} [questionDelay] - Delay before showing question in seconds
 * @property {boolean} [showImage] - Whether to show image
 * @property {number} [imageDelay] - Delay before showing image in seconds
 * @property {boolean} [showAudio] - Whether to show audio
 * @property {number} [audioDelay] - Delay before showing audio in seconds
 * @property {boolean} [showVideo] - Whether to show video
 * @property {number} [videoDelay] - Delay before showing video in seconds
 * @property {boolean} [showLink] - Whether to show link
 * @property {number} [linkDelay] - Delay before showing link in seconds
 * @property {boolean} [showCode] - Whether to show code
 * @property {number} [codeDelay] - Delay before showing code in seconds
 * @property {boolean} [showMath] - Whether to show math
 * @property {number} [mathDelay] - Delay before showing math in seconds
 * @property {boolean} [showTable] - Whether to show table
 * @property {number} [tableDelay] - Delay before showing table in seconds
 * @property {boolean} [showList] - Whether to show list
 * @property {number} [listDelay] - Delay before showing list in seconds
 * @property {boolean} [showQuote] - Whether to show quote
 * @property {number} [quoteDelay] - Delay before showing quote in seconds
 * @property {boolean} [showDefinition] - Whether to show definition
 * @property {number} [definitionDelay] - Delay before showing definition in seconds
 * @property {boolean} [showTranslation] - Whether to show translation
 * @property {number} [translationDelay] - Delay before showing translation in seconds
 * @property {boolean} [showPronunciation] - Whether to show pronunciation
 * @property {number} [pronunciationDelay] - Delay before showing pronunciation in seconds
 * @property {boolean} [showContext] - Whether to show context
 * @property {number} [contextDelay] - Delay before showing context in seconds
 * @property {boolean} [showNotes] - Whether to show notes
 * @property {number} [notesDelay] - Delay before showing notes in seconds
 * @property {boolean} [showTags] - Whether to show tags
 * @property {number} [tagsDelay] - Delay before showing tags in seconds
 * @property {boolean} [showStats] - Whether to show statistics
 * @property {number} [statsDelay] - Delay before showing statistics in seconds
 * @property {boolean} [showProgress] - Whether to show progress
 * @property {number} [progressDelay] - Delay before showing progress in seconds
 * @property {boolean} [showTimer] - Whether to show a timer
 * @property {number} [timerDelay] - Delay before showing timer in seconds
 * @property {boolean} [showScore] - Whether to show score
 * @property {number} [scoreDelay] - Delay before showing score in seconds
 * @property {boolean} [showFeedback] - Whether to show feedback
 * @property {number} [feedbackDelay] - Delay before showing feedback in seconds
 */
export interface DeckSettings {
  // ... existing code ...
} 