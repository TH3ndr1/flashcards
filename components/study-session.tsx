/**
 * Study session component that manages the overall study experience.
 * 
 * This component orchestrates the study session by:
 * - Managing the current card and session state
 * - Handling card progression and review scheduling
 * - Providing study controls and progress tracking
 * - Integrating with the spaced repetition system
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Card[]} props.cards - Array of cards to study
 * @param {() => void} props.onComplete - Callback when the study session is completed
 * @param {(cardId: string, rating: number) => void} props.onRateCard - Callback for rating a card
 * @returns {JSX.Element} The complete study session interface
 */
export function StudySession({
  cards,
  onComplete,
  onRateCard,
}: {
  cards: Card[];
  onComplete: () => void;
  onRateCard: (cardId: string, rating: number) => void;
}) {
// ... existing code ...
} 