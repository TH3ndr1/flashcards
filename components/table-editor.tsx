"use client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, Plus } from "lucide-react"
import type { FlashCard } from "@/types/deck"

interface TableEditorProps {
  cards: FlashCard[]
  onUpdate: (id: string, question: string, answer: string) => void
  onDelete: (id: string) => void
  onAdd: () => void
}

export function TableEditor({ cards, onUpdate, onDelete, onAdd }: TableEditorProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Card
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50%]">Question</TableHead>
              <TableHead className="w-[45%]">Answer</TableHead>
              <TableHead className="w-[5%]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  No cards in this deck yet. Click "Add Card" to get started.
                </TableCell>
              </TableRow>
            ) : (
              cards.map((card) => (
                <TableRow key={card.id}>
                  <TableCell>
                    <Input
                      value={card.question}
                      onChange={(e) => onUpdate(card.id, e.target.value, card.answer)}
                      placeholder="Enter question"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={card.answer}
                      onChange={(e) => onUpdate(card.id, card.question, e.target.value)}
                      placeholder="Enter answer"
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(card.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

