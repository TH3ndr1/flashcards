"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Save, Loader2 as IconLoader } from "lucide-react"
import type { Tables } from "@/types/database"
import { debounce } from "@/lib/utils"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const POS_OPTIONS: ReadonlyArray<string> = ['Noun', 'Verb', 'Adjective', 'Adverb', 'Pronoun', 'Preposition', 'Interjection', 'Other', 'N/A'];
const GENDER_OPTIONS = [
    { value: 'Male', label: 'Male'},
    { value: 'Female', label: 'Female'},
    { value: 'Default', label: 'Neutral / Other'}
];
const GENDERED_POS: ReadonlyArray<string> = ['Noun', 'Adjective', 'Pronoun'] as const;

const DEBOUNCE_WAIT_MS = 500;

type DbCard = Tables<'cards'>;
type CardDataInput = Pick<DbCard, 'question' | 'answer' | 'question_part_of_speech' | 'question_gender' | 'answer_part_of_speech' | 'answer_gender'>;

interface CardEditorProps {
  card: Partial<DbCard> | null
  onUpdate: (id: string, data: Partial<CardDataInput>) => void
  onDelete: (id: string) => void
  onCreate?: (data: CardDataInput) => Promise<string | null>
}

export function CardEditor({ card, onUpdate, onDelete, onCreate }: CardEditorProps) {
  const [internalQuestion, setInternalQuestion] = useState(card?.question || '')
  const [internalAnswer, setInternalAnswer] = useState(card?.answer || '')
  const [internalQuestionPos, setInternalQuestionPos] = useState(card?.question_part_of_speech || 'N/A')
  const [internalQuestionGender, setInternalQuestionGender] = useState(card?.question_gender || 'Default')
  const [internalAnswerPos, setInternalAnswerPos] = useState(card?.answer_part_of_speech || 'N/A')
  const [internalAnswerGender, setInternalAnswerGender] = useState(card?.answer_gender || 'Default')
  const [isSavingNew, setIsSavingNew] = useState(false)
  const isExistingCard = !!card?.id && !card.id.startsWith('new-');

  useEffect(() => {
    setInternalQuestion(card?.question || '')
    setInternalAnswer(card?.answer || '')
    setInternalQuestionPos(card?.question_part_of_speech || 'N/A')
    setInternalQuestionGender(card?.question_gender || 'Default')
    setInternalAnswerPos(card?.answer_part_of_speech || 'N/A')
    setInternalAnswerGender(card?.answer_gender || 'Default')
    setIsSavingNew(false)
  }, [card]);

  const debouncedOnUpdate = useCallback(
    debounce((data: Partial<CardDataInput>) => {
      if (isExistingCard && card?.id) {
        console.log('[CardEditor] Debounced update triggered for ID:', card.id, 'Data:', data);
        onUpdate(card.id, data)
      }
    }, DEBOUNCE_WAIT_MS),
    [onUpdate, card?.id, isExistingCard]
  );

  const handleTextChange = (field: 'question' | 'answer', value: string) => {
    const updates: Partial<CardDataInput> = {};
    if (field === 'question') {
      setInternalQuestion(value);
      updates.question = value;
      updates.answer = internalAnswer;
    } else {
      setInternalAnswer(value);
      updates.answer = value;
      updates.question = internalQuestion;
    }
    updates.question_part_of_speech = internalQuestionPos === 'N/A' ? null : internalQuestionPos;
    updates.question_gender = internalQuestionGender === 'Default' ? null : internalQuestionGender;
    updates.answer_part_of_speech = internalAnswerPos === 'N/A' ? null : internalAnswerPos;
    updates.answer_gender = internalAnswerGender === 'Default' ? null : internalAnswerGender;

    if (isExistingCard) {
        debouncedOnUpdate(updates);
    }
  }

  const handleClassificationChange = (field: 'question_part_of_speech' | 'question_gender' | 'answer_part_of_speech' | 'answer_gender', value: string | null) => {
    const updates: Partial<CardDataInput> = {
        question: internalQuestion,
        answer: internalAnswer,
        question_part_of_speech: internalQuestionPos === 'N/A' ? null : internalQuestionPos,
        question_gender: internalQuestionGender === 'Default' ? null : internalQuestionGender,
        answer_part_of_speech: internalAnswerPos === 'N/A' ? null : internalAnswerPos,
        answer_gender: internalAnswerGender === 'Default' ? null : internalAnswerGender,
    };

    if (field === 'question_part_of_speech') {
      const newPos = value || 'N/A';
      setInternalQuestionPos(newPos);
      updates.question_part_of_speech = newPos === 'N/A' ? null : newPos;
      if (!GENDERED_POS.includes(newPos)) {
        setInternalQuestionGender('Default');
        updates.question_gender = null;
      }
    } else if (field === 'question_gender') {
      const newGender = value || 'Default';
      setInternalQuestionGender(newGender);
      updates.question_gender = newGender === 'Default' ? null : newGender;
    } else if (field === 'answer_part_of_speech') {
      const newPos = value || 'N/A';
      setInternalAnswerPos(newPos);
      updates.answer_part_of_speech = newPos === 'N/A' ? null : newPos;
      if (!GENDERED_POS.includes(newPos)) {
        setInternalAnswerGender('Default');
        updates.answer_gender = null;
      }
    } else if (field === 'answer_gender') {
      const newGender = value || 'Default';
      setInternalAnswerGender(newGender);
      updates.answer_gender = newGender === 'Default' ? null : newGender;
    }

    if (isExistingCard) {
      debouncedOnUpdate(updates);
    }
  }

  const handleDelete = () => {
    if (isExistingCard && card?.id) {
        onDelete(card.id);
    } else if (!isExistingCard && card?.id) {
        onDelete(card.id);
    }
  }

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

      const cardData: CardDataInput = {
          question: question,
          answer: answer,
          question_part_of_speech: internalQuestionPos === 'N/A' ? null : internalQuestionPos,
          question_gender: internalQuestionGender === 'Default' ? null : internalQuestionGender,
          answer_part_of_speech: internalAnswerPos === 'N/A' ? null : internalAnswerPos,
          answer_gender: internalAnswerGender === 'Default' ? null : internalAnswerGender,
      }

      setIsSavingNew(true);
      try {
         await onCreate(cardData);
      } catch (error) {
          console.error("Error calling onCreate prop:", error);
      } finally {
           setIsSavingNew(false);
      }
  };

  const cardIdSuffix = card?.id || 'new';

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
          >
              <Trash2 className="h-4 w-4" />
          </Button>
       )}

      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`question-${cardIdSuffix}`} className="block text-sm font-medium">Question</Label>
            <Textarea
              id={`question-${cardIdSuffix}`}
              placeholder="Enter question..."
              value={internalQuestion}
              onChange={(e) => handleTextChange('question', e.target.value)}
              className="min-h-[100px]"
              aria-label="Question content"
            />
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2">
              <div>
                <Label htmlFor={`q-pos-${cardIdSuffix}`} className="text-xs text-muted-foreground">Type</Label>
                <Select
                  value={internalQuestionPos}
                  onValueChange={(value) => handleClassificationChange('question_part_of_speech', value)}
                  name={`q-pos-${cardIdSuffix}`}
                >
                  <SelectTrigger id={`q-pos-${cardIdSuffix}`} className="h-9 text-xs">
                    <SelectValue placeholder="Select PoS..." />
                  </SelectTrigger>
                  <SelectContent>
                    {POS_OPTIONS.map(pos => <SelectItem key={pos} value={pos} className="text-xs">{pos}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                {GENDERED_POS.includes(internalQuestionPos) && (
                  <>
                    <Label htmlFor={`q-gender-${cardIdSuffix}`} className="text-xs text-muted-foreground">Gender</Label>
                    <Select
                      value={internalQuestionGender}
                      onValueChange={(value) => handleClassificationChange('question_gender', value)}
                      name={`q-gender-${cardIdSuffix}`}
                    >
                      <SelectTrigger id={`q-gender-${cardIdSuffix}`} className="h-9 text-xs">
                         <SelectValue placeholder="Select Gender..." />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDER_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`answer-${cardIdSuffix}`} className="block text-sm font-medium">Answer</Label>
            <Textarea
              id={`answer-${cardIdSuffix}`}
              placeholder="Enter answer..."
              value={internalAnswer}
              onChange={(e) => handleTextChange('answer', e.target.value)}
              className="min-h-[100px]"
              aria-label="Answer content"
            />
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2">
              <div>
                <Label htmlFor={`a-pos-${cardIdSuffix}`} className="text-xs text-muted-foreground">Type</Label>
                <Select
                  value={internalAnswerPos}
                  onValueChange={(value) => handleClassificationChange('answer_part_of_speech', value)}
                  name={`a-pos-${cardIdSuffix}`}
                >
                  <SelectTrigger id={`a-pos-${cardIdSuffix}`} className="h-9 text-xs">
                    <SelectValue placeholder="Select PoS..." />
                  </SelectTrigger>
                  <SelectContent>
                    {POS_OPTIONS.map(pos => <SelectItem key={pos} value={pos} className="text-xs">{pos}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                {GENDERED_POS.includes(internalAnswerPos) && (
                  <>
                    <Label htmlFor={`a-gender-${cardIdSuffix}`} className="text-xs text-muted-foreground">Gender</Label>
                    <Select
                      value={internalAnswerGender}
                      onValueChange={(value) => handleClassificationChange('answer_gender', value)}
                      name={`a-gender-${cardIdSuffix}`}
                    >
                      <SelectTrigger id={`a-gender-${cardIdSuffix}`} className="h-9 text-xs">
                         <SelectValue placeholder="Select Gender..." />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDER_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>)}
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

