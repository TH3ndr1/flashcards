"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Trash2 } from "lucide-react"
import type { FlashCard } from "@/types/deck"
import { debounce } from "@/lib/utils"

const DEBOUNCE_WAIT_MS = 500;

interface CardEditorProps {
  card: FlashCard
  onUpdate: (question: string, answer: string) => void
  onDelete: () => void
}

export function CardEditor({ card, onUpdate, onDelete }: CardEditorProps) {
  const [internalQuestion, setInternalQuestion] = useState(card.question)
  const [internalAnswer, setInternalAnswer] = useState(card.answer)

  useEffect(() => {
    setInternalQuestion(card.question)
    setInternalAnswer(card.answer)
  }, [card])

  const debouncedOnUpdate = useCallback(
    debounce((q: string, a: string) => {
      onUpdate(q, a)
    }, DEBOUNCE_WAIT_MS),
    [onUpdate]
  );

  const handleQuestionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newQuestion = e.target.value;
    setInternalQuestion(newQuestion);
    debouncedOnUpdate(newQuestion, internalAnswer);
  }

  const handleAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newAnswer = e.target.value;
    setInternalAnswer(newAnswer);
    debouncedOnUpdate(internalQuestion, newAnswer);
  }

  return (
    <Card>
      <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Question</label>
          <Textarea
            placeholder="Enter question"
            value={internalQuestion}
            onChange={handleQuestionChange}
            className="min-h-[100px]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Answer</label>
          <Textarea
            placeholder="Enter answer"
            value={internalAnswer}
            onChange={handleAnswerChange}
            className="min-h-[100px]"
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-end p-4 pt-0">
        <Button variant="outline" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}

