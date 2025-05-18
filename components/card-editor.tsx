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
import { debounce } from "@/lib/utils"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const POS_OPTIONS: ReadonlyArray<string> = ['Noun', 'Verb', 'Adjective', 'Adverb', 'Pronoun', 'Preposition', 'Interjection', 'Other', 'N/A'];
const GENDER_OPTIONS = [
    { value: 'Male', label: 'Male'},
    { value: 'Female', label: 'Female'},
    // Ensure 'Default' is a valid key if used for 'N/A' / 'Neutral' for DB storage
    { value: 'Default', label: 'Neutral / Other'}
];
const GENDERED_POS: ReadonlyArray<string> = ['Noun', 'Adjective', 'Pronoun'] as const;

const DEBOUNCE_WAIT_MS = 750; // Slightly increased debounce for stability

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
    setInternalQuestion(card?.question || '');
    setInternalAnswer(card?.answer || '');
    setInternalQuestionPos(card?.question_part_of_speech || 'N/A');
    setInternalQuestionGender(card?.question_gender || 'Default');
    setInternalAnswerPos(card?.answer_part_of_speech || 'N/A');
    setInternalAnswerGender(card?.answer_gender || 'Default');
    setIsSavingNew(false);
  }, [card]); // Dependencies are correct

  const debouncedOnUpdate = useCallback(
    debounce((data: PartialCardDataInput) => {
      if (isExistingCard && card?.id) {
        console.log('[CardEditor] Debounced update triggered for ID:', card.id, 'Data:', data);
        onUpdate(card.id, data);
      }
    }, DEBOUNCE_WAIT_MS),
    // card.id and isExistingCard are derived from props, stable if card prop is stable
    [onUpdate, card?.id, isExistingCard]
  );

  const handleFieldChange = (
    updatesToApply: PartialCardDataInput
  ) => {
    // Update local state first
    if (updatesToApply.question !== undefined) setInternalQuestion(updatesToApply.question);
    if (updatesToApply.answer !== undefined) setInternalAnswer(updatesToApply.answer);
    if (updatesToApply.question_part_of_speech !== undefined) setInternalQuestionPos(updatesToApply.question_part_of_speech === null ? 'N/A' : updatesToApply.question_part_of_speech);
    if (updatesToApply.question_gender !== undefined) setInternalQuestionGender(updatesToApply.question_gender === null ? 'Default' : updatesToApply.question_gender);
    if (updatesToApply.answer_part_of_speech !== undefined) setInternalAnswerPos(updatesToApply.answer_part_of_speech === null ? 'N/A' : updatesToApply.answer_part_of_speech);
    if (updatesToApply.answer_gender !== undefined) setInternalAnswerGender(updatesToApply.answer_gender === null ? 'Default' : updatesToApply.answer_gender);

    // Prepare data for debounced update or create
    const currentData: PartialCardDataInput = {
        question: updatesToApply.question !== undefined ? updatesToApply.question : internalQuestion,
        answer: updatesToApply.answer !== undefined ? updatesToApply.answer : internalAnswer,
        question_part_of_speech: (updatesToApply.question_part_of_speech !== undefined ? updatesToApply.question_part_of_speech : internalQuestionPos) === 'N/A' ? null : (updatesToApply.question_part_of_speech ?? internalQuestionPos),
        question_gender: (updatesToApply.question_gender !== undefined ? updatesToApply.question_gender : internalQuestionGender) === 'Default' ? null : (updatesToApply.question_gender ?? internalQuestionGender),
        answer_part_of_speech: (updatesToApply.answer_part_of_speech !== undefined ? updatesToApply.answer_part_of_speech : internalAnswerPos) === 'N/A' ? null : (updatesToApply.answer_part_of_speech ?? internalAnswerPos),
        answer_gender: (updatesToApply.answer_gender !== undefined ? updatesToApply.answer_gender : internalAnswerGender) === 'Default' ? null : (updatesToApply.answer_gender ?? internalAnswerGender),
    };


    if (isExistingCard) {
        debouncedOnUpdate(currentData);
    }
    // For new cards, the "Save New Card" button will handle the create action
  };


  const handleDelete = () => {
    if (card?.id) { // Works for both existing and placeholder IDs
        onDelete(card.id);
    }
  };

  const handleCreate = async () => {
      if (!onCreate) {
          console.error("onCreate prop is missing from CardEditor for a new card.");
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
          console.error("Error calling onCreate prop:", error);
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
              onChange={(e) => handleFieldChange({ question: e.target.value })}
              className="min-h-[100px]"
              aria-label="Question content"
              disabled={isSavingNew}
            />
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2">
              <div>
                <Label htmlFor={`q-pos-${cardIdSuffix}`} className="text-xs text-muted-foreground">Type</Label>
                <Select
                  value={internalQuestionPos}
                  onValueChange={(value) => handleFieldChange({ question_part_of_speech: value })}
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
                      onValueChange={(value) => handleFieldChange({ question_gender: value })}
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
              onChange={(e) => handleFieldChange({ answer: e.target.value })}
              className="min-h-[100px]"
              aria-label="Answer content"
              disabled={isSavingNew}
            />
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2">
              <div>
                <Label htmlFor={`a-pos-${cardIdSuffix}`} className="text-xs text-muted-foreground">Type</Label>
                <Select
                  value={internalAnswerPos}
                  onValueChange={(value) => handleFieldChange({ answer_part_of_speech: value })}
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
                      onValueChange={(value) => handleFieldChange({ answer_gender: value })}
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

      {!isExistingCard && onCreate && (
        <CardFooter className="flex justify-end p-3 bg-muted/50 border-t">
           <Button onClick={handleCreate} disabled={isSavingNew || !internalQuestion.trim() || !internalAnswer.trim()} size="sm">
              {isSavingNew ? <IconLoader className="h-4 w-4 animate-spin mr-2"/> : <Save className="h-4 w-4 mr-2" />} Save New Card
           </Button>
        </CardFooter>
      )}
    </Card>
  )
}