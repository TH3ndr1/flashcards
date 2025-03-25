"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Trash2 } from "lucide-react"
import type { FlashCard } from "@/types/deck"

interface CardEditorProps {
  card: FlashCard
  onUpdate: (question: string, answer: string) => void
  onDelete: () => void
}

export function CardEditor({ card, onUpdate, onDelete }: CardEditorProps) {
  const [question, setQuestion] = useState(card.question)
  const [answer, setAnswer] = useState(card.answer)

  useEffect(() => {
    setQuestion(card.question)
    setAnswer(card.answer)
  }, [card])

  const handleQuestionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuestion(e.target.value)
    onUpdate(e.target.value, answer)
  }

  const handleAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setAnswer(e.target.value)
    onUpdate(question, e.target.value)
  }

  return (
    <Card>
      <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Question</label>
          <Textarea
            placeholder="Enter question"
            value={question}
            onChange={handleQuestionChange}
            className="min-h-[100px]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Answer</label>
          <Textarea placeholder="Enter answer" value={answer} onChange={handleAnswerChange} className="min-h-[100px]" />
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

