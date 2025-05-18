// components/table-editor.tsx
"use client"
import { useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input" // Using Input for simpler inline editing
import { Trash2, Plus } from "lucide-react"
import type { Tables } from "@/types/database" // Import Tables
import { debounce } from "@/lib/utils"

const DEBOUNCE_WAIT_MS = 500;

// Use Tables<'cards'> as the source of truth for card type
type DbCard = Tables<'cards'>;

interface TableEditorProps {
  cards: DbCard[]; // Expect DbCard array
  onUpdate: (id: string, question: string, answer: string) => void; // Simple update for Q/A
  onDelete: (id: string) => void;
  onAdd: () => void;
}

export function TableEditor({ cards, onUpdate, onDelete, onAdd }: TableEditorProps) {
  // Debounced update handlers remain the same, onUpdate is simple
  const debouncedUpdateHandlers = useMemo(() => {
    const handlers: Record<string, (question: string, answer: string) => void> = {};
    cards.forEach(card => {
      // Ensure card.id is not null or undefined before using it as a key
      if (card.id) {
        handlers[card.id] = debounce((question: string, answer: string) => {
          onUpdate(card.id!, question, answer); // Use non-null assertion if ID is guaranteed here
        }, DEBOUNCE_WAIT_MS);
      }
    });
    return handlers;
  }, [cards, onUpdate]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Card
        </Button>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[calc(50%-2rem)]">Question</TableHead>
              <TableHead className="w-[calc(50%-2rem)]">Answer</TableHead>
              <TableHead className="w-[4rem] text-right pr-2">Actions</TableHead>
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
              cards.map((card) => ( // card is now DbCard
                <TableRow key={card.id}>
                  <TableCell className="py-1">
                    <Input
                      defaultValue={card.question} // Access question directly
                      onChange={(e) => {
                        const newQuestion = e.target.value;
                        // Ensure card.id and card.answer are not null/undefined
                        if (card.id && card.answer !== null && card.answer !== undefined) {
                           debouncedUpdateHandlers[card.id]?.(newQuestion, card.answer);
                        }
                      }}
                      placeholder="Enter question"
                      className="h-9 text-sm"
                    />
                  </TableCell>
                  <TableCell className="py-1">
                    <Input
                      defaultValue={card.answer} // Access answer directly
                      onChange={(e) => {
                        const newAnswer = e.target.value;
                        // Ensure card.id and card.question are not null/undefined
                         if (card.id && card.question !== null && card.question !== undefined) {
                            debouncedUpdateHandlers[card.id]?.(card.question, newAnswer);
                         }
                      }}
                      placeholder="Enter answer"
                      className="h-9 text-sm"
                    />
                  </TableCell>
                  <TableCell className="py-1 text-right pr-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => card.id && onDelete(card.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
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