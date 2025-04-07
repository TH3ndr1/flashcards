"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Trash2, Save, Loader2 as IconLoader } from "lucide-react"
import type { DbCard } from "@/types/database"
import { debounce } from "@/lib/utils"
import { CardTagEditor } from "./CardTagEditor"
import { toast } from "sonner"

const DEBOUNCE_WAIT_MS = 500;

interface CardEditorProps {
  card: Partial<DbCard> | null
  onUpdate: (id: string, question: string, answer: string) => void
  onDelete: (id: string) => void
  onCreate?: (question: string, answer: string) => Promise<string | null>
}

export function CardEditor({ card, onUpdate, onDelete, onCreate }: CardEditorProps) {
  const [internalQuestion, setInternalQuestion] = useState(card?.question || '')
  const [internalAnswer, setInternalAnswer] = useState(card?.answer || '')
  const [isSavingNew, setIsSavingNew] = useState(false)
  const isExistingCard = !!card?.id

  useEffect(() => {
    setInternalQuestion(card?.question || '')
    setInternalAnswer(card?.answer || '')
    setIsSavingNew(false)
  }, [card?.id, card?.question, card?.answer])

  const debouncedOnUpdate = useCallback(
    debounce((question: string, answer: string) => {
      if (isExistingCard && card?.id) {
        onUpdate(card.id, question, answer)
      }
    }, DEBOUNCE_WAIT_MS),
    [onUpdate, card?.id, isExistingCard]
  );

  const handleQuestionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newQuestion = e.target.value;
    setInternalQuestion(newQuestion);
    if (isExistingCard) {
        debouncedOnUpdate(newQuestion, internalAnswer);
    }
  }

  const handleAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newAnswer = e.target.value;
    setInternalAnswer(newAnswer);
    if (isExistingCard) {
        debouncedOnUpdate(internalQuestion, newAnswer);
    }
  }

  const handleDelete = () => {
    if (isExistingCard && card?.id) {
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

      setIsSavingNew(true);
      try {
         await onCreate(question, answer);
      } catch (error) {
          console.error("Error calling onCreate prop:", error);
          toast.error("Failed to save card due to an unexpected error.");
      } finally {
           setIsSavingNew(false); 
      }
  };

  return (
    <Card className={!isExistingCard ? "border-primary border-2 shadow-lg shadow-primary/20" : ""}>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`question-${card?.id || 'new'}`} className="block text-sm font-medium mb-1">Question</label>
            <Textarea
              id={`question-${card?.id || 'new'}`}
              placeholder="Enter question..."
              value={internalQuestion}
              onChange={handleQuestionChange}
              className="min-h-[100px]"
              aria-label="Question content"
            />
          </div>
          <div>
            <label htmlFor={`answer-${card?.id || 'new'}`} className="block text-sm font-medium mb-1">Answer</label>
            <Textarea
              id={`answer-${card?.id || 'new'}`}
              placeholder="Enter answer..."
              value={internalAnswer}
              onChange={handleAnswerChange}
              className="min-h-[100px]"
              aria-label="Answer content"
            />
          </div>
        </div>

        {isExistingCard && card.id && (
            <div className="pt-2 border-t mt-4">
                <CardTagEditor cardId={card.id} />
            </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end p-4 pt-2">
         {isExistingCard && card.id && (
            <Button variant="ghost" size="icon" onClick={handleDelete} aria-label="Delete card" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
            </Button>
         )}
         {!isExistingCard && onCreate && (
             <Button onClick={handleCreate} disabled={isSavingNew || !internalQuestion.trim() || !internalAnswer.trim()} size="sm">
                {isSavingNew ? <IconLoader className="h-4 w-4 animate-spin mr-2"/> : <Save className="h-4 w-4 mr-2" />} 
                Save New Card
             </Button>
         )}
      </CardFooter>
    </Card>
  )
}

