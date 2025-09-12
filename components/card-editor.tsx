// components/card-editor.tsx
"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Save, Loader2 as IconLoader } from "lucide-react"
import type { Tables } from "@/types/database" // Use generated DB types
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { appLogger } from "@/lib/logger"

const POS_OPTIONS: ReadonlyArray<string> = ['Noun', 'Verb', 'Adjective', 'Adverb', 'Pronoun', 'Preposition', 'Interjection', 'Other', 'N/A'];
const GENDER_OPTIONS = [
    { value: 'Male', label: 'Male'},
    { value: 'Female', label: 'Female'},
    // Ensure 'Default' is a valid key if used for 'N/A' / 'Neutral' for DB storage
    { value: 'Default', label: 'Neutral / Other'}
];
const GENDERED_POS: ReadonlyArray<string> = ['Noun', 'Adjective', 'Pronoun'] as const;

// Use Tables<'cards'> for card data
type DbCard = Tables<'cards'>;

// Define input types based on DbCard structure (snake_case)
type CardDataInput = Pick<DbCard,
    'question' |
    'answer' |
    'question_part_of_speech' |
    'question_gender' |
    'answer_part_of_speech' |
    'answer_gender'
>;
type PartialCardDataInput = Partial<CardDataInput>;


interface CardEditorProps {
  card: Partial<DbCard> | null; // Accept Partial<DbCard> for new/existing
  onUpdate: (id: string, data: PartialCardDataInput) => void;
  onDelete: (id: string) => void;
  onCreate?: (data: CardDataInput) => Promise<string | null>; // Returns new card ID or null
}

export function CardEditor({ card, onUpdate, onDelete, onCreate }: CardEditorProps) {
  // Initialize state using snake_case fields from DbCard
  const [internalQuestion, setInternalQuestion] = useState(card?.question || '');
  const [internalAnswer, setInternalAnswer] = useState(card?.answer || '');
  const [internalQuestionPos, setInternalQuestionPos] = useState(card?.question_part_of_speech || 'N/A');
  const [internalQuestionGender, setInternalQuestionGender] = useState(card?.question_gender || 'Default'); // Assuming 'Default' maps to null or 'N/A' for DB
  const [internalAnswerPos, setInternalAnswerPos] = useState(card?.answer_part_of_speech || 'N/A');
  const [internalAnswerGender, setInternalAnswerGender] = useState(card?.answer_gender || 'Default');

  const [isSavingNew, setIsSavingNew] = useState(false);
  const isExistingCard = !!card?.id && !card.id.startsWith('new-');

  useEffect(() => {
    // This effect ensures the internal state is updated if the card prop changes.
    // This is important if the parent component updates the card data after a save.
    setInternalQuestion(card?.question || '');
    setInternalAnswer(card?.answer || '');
    setInternalQuestionPos(card?.question_part_of_speech || 'N/A');
    setInternalQuestionGender(card?.question_gender || 'Default');
    setInternalAnswerPos(card?.answer_part_of_speech || 'N/A');
    setInternalAnswerGender(card?.answer_gender || 'Default');
    setIsSavingNew(false); // Reset saving state if card instance changes
  }, [card]); // Dependency is the card prop itself.

  const handleQuestionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInternalQuestion(e.target.value);
  };

  const handleAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInternalAnswer(e.target.value);
  };

  const handleQuestionBlur = () => {
    const trimmed = internalQuestion.trim();
    if (!isExistingCard && onCreate && trimmed && internalAnswer.trim()) {
      // Autosave for new card when both fields are filled
      if (!isSavingNew) handleCreate();
      return;
    }
    if (isExistingCard && card?.id && trimmed !== (card?.question ?? '')) {
      appLogger.info('[CardEditor] Question blur update for ID:', card.id);
      onUpdate(card.id, { question: trimmed });
    }
  };

  const handleAnswerBlur = () => {
    const trimmed = internalAnswer.trim();
    if (!isExistingCard && onCreate && trimmed && internalQuestion.trim()) {
      // Autosave for new card when both fields are filled
      if (!isSavingNew) handleCreate();
      return;
    }
    if (isExistingCard && card?.id && trimmed !== (card?.answer ?? '')) {
      appLogger.info('[CardEditor] Answer blur update for ID:', card.id);
      onUpdate(card.id, { answer: trimmed });
    }
  };

  const handleSelectChange = (
    field: keyof Pick<CardDataInput, 'question_part_of_speech' | 'question_gender' | 'answer_part_of_speech' | 'answer_gender'>, 
    value: string
  ) => {
    const actualValue = (value === 'N/A' || value === 'Default') ? null : value;
    let changed = false;

    if (field === 'question_part_of_speech') {
      setInternalQuestionPos(value); // value here is 'N/A' or actual PoS
      if (actualValue !== card?.question_part_of_speech) changed = true;
    } else if (field === 'question_gender') {
      setInternalQuestionGender(value); // value here is 'Default' or actual Gender
      if (actualValue !== card?.question_gender) changed = true;
    } else if (field === 'answer_part_of_speech') {
      setInternalAnswerPos(value);
      if (actualValue !== card?.answer_part_of_speech) changed = true;
    } else if (field === 'answer_gender') {
      setInternalAnswerGender(value);
      if (actualValue !== card?.answer_gender) changed = true;
    }

    if (isExistingCard && card?.id && changed) {
      appLogger.info('[CardEditor] Select change update for ID:', card.id, 'Field:', field, 'Value:', actualValue);
      onUpdate(card.id, { [field]: actualValue });
    }
  };

  const handleDelete = () => {
    if (card?.id) { // Works for both existing and placeholder IDs
        onDelete(card.id);
    }
  };

  const handleCreate = async () => {
      if (!onCreate) {
          appLogger.error("onCreate prop is missing from CardEditor for a new card.");
          toast.error("Cannot save new card: Configuration error.");
          return;
      }

      const question = internalQuestion.trim();
      const answer = internalAnswer.trim();
      if (!question || !answer) {
          toast.error("Question and Answer content cannot be empty.");
          return;
      }

      const cardDataToCreate: CardDataInput = {
          question: question,
          answer: answer,
          question_part_of_speech: internalQuestionPos === 'N/A' ? null : internalQuestionPos,
          question_gender: internalQuestionGender === 'Default' ? null : internalQuestionGender,
          answer_part_of_speech: internalAnswerPos === 'N/A' ? null : internalAnswerPos,
          answer_gender: internalAnswerGender === 'Default' ? null : internalAnswerGender,
      };

      setIsSavingNew(true);
      try {
         await onCreate(cardDataToCreate);
         // Optimistic: Parent should replace this card, so state might reset via useEffect,
         // or parent could explicitly clear/update this editor instance.
         // For now, assume parent handles the transition from placeholder to real card.
      } catch (error) {
          appLogger.error("Error calling onCreate prop:", error);
          // Error is typically toasted by parent/action
      } finally {
           setIsSavingNew(false);
      }
  };

  const cardIdSuffix = card?.id || 'new-unsaved'; // More descriptive suffix

  return (
    <Card className={cn(
      "relative",
      !isExistingCard && card?.id?.startsWith('new-') ? "border-primary border-2 shadow-lg shadow-primary/20" : ""
    )}>
       {(isExistingCard || card?.id?.startsWith('new-')) && card?.id && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            aria-label="Delete card"
            className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-10"
            disabled={isSavingNew} // Disable delete while saving new
          >
              <Trash2 className="h-4 w-4" />
          </Button>
       )}

      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Question Section */}
          <div className="space-y-2">
            <Label htmlFor={`question-${cardIdSuffix}`} className="block text-sm font-medium">Question</Label>
            <Textarea
              id={`question-${cardIdSuffix}`}
              placeholder="Enter question..."
              value={internalQuestion}
              onChange={handleQuestionChange}
              onBlur={handleQuestionBlur}
              className="min-h-[100px]"
              aria-label="Question content"
              disabled={isSavingNew}
            />
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2">
              <div>
                <Label htmlFor={`q-pos-${cardIdSuffix}`} className="text-xs text-muted-foreground">Type</Label>
                <Select
                  value={internalQuestionPos}
                  onValueChange={(value) => handleSelectChange('question_part_of_speech', value)}
                  name={`q-pos-${cardIdSuffix}`}
                  disabled={isSavingNew}
                >
                  <SelectTrigger id={`q-pos-${cardIdSuffix}`} className="h-9 text-xs">
                    <SelectValue placeholder="Select PoS..." />
                  </SelectTrigger>
                  <SelectContent>
                    {POS_OPTIONS.map(pos => <SelectItem key={`q-pos-${pos}`} value={pos} className="text-xs">{pos}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                {GENDERED_POS.includes(internalQuestionPos) && (
                  <>
                    <Label htmlFor={`q-gender-${cardIdSuffix}`} className="text-xs text-muted-foreground">Gender</Label>
                    <Select
                      value={internalQuestionGender}
                      onValueChange={(value) => handleSelectChange('question_gender', value)}
                      name={`q-gender-${cardIdSuffix}`}
                      disabled={isSavingNew}
                    >
                      <SelectTrigger id={`q-gender-${cardIdSuffix}`} className="h-9 text-xs">
                         <SelectValue placeholder="Select Gender..." />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDER_OPTIONS.map(opt => <SelectItem key={`q-gender-${opt.value}`} value={opt.value} className="text-xs">{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Answer Section */}
          <div className="space-y-2">
            <Label htmlFor={`answer-${cardIdSuffix}`} className="block text-sm font-medium">Answer</Label>
            <Textarea
              id={`answer-${cardIdSuffix}`}
              placeholder="Enter answer..."
              value={internalAnswer}
              onChange={handleAnswerChange}
              onBlur={handleAnswerBlur}
              className="min-h-[100px]"
              aria-label="Answer content"
              disabled={isSavingNew}
            />
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2">
              <div>
                <Label htmlFor={`a-pos-${cardIdSuffix}`} className="text-xs text-muted-foreground">Type</Label>
                <Select
                  value={internalAnswerPos}
                  onValueChange={(value) => handleSelectChange('answer_part_of_speech', value)}
                  name={`a-pos-${cardIdSuffix}`}
                  disabled={isSavingNew}
                >
                  <SelectTrigger id={`a-pos-${cardIdSuffix}`} className="h-9 text-xs">
                    <SelectValue placeholder="Select PoS..." />
                  </SelectTrigger>
                  <SelectContent>
                    {POS_OPTIONS.map(pos => <SelectItem key={`a-pos-${pos}`} value={pos} className="text-xs">{pos}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                {GENDERED_POS.includes(internalAnswerPos) && (
                  <>
                    <Label htmlFor={`a-gender-${cardIdSuffix}`} className="text-xs text-muted-foreground">Gender</Label>
                    <Select
                      value={internalAnswerGender}
                      onValueChange={(value) => handleSelectChange('answer_gender', value)}
                      name={`a-gender-${cardIdSuffix}`}
                      disabled={isSavingNew}
                    >
                      <SelectTrigger id={`a-gender-${cardIdSuffix}`} className="h-9 text-xs">
                         <SelectValue placeholder="Select Gender..." />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDER_OPTIONS.map(opt => <SelectItem key={`a-gender-${opt.value}`} value={opt.value} className="text-xs">{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Footer with explicit save is no longer required for new cards since autosave on blur is enabled.
          Keeping it hidden to avoid UX confusion. */}
    </Card>
  )
}

CardEditor.displayName = 'CardEditor';