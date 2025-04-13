// lib/schema/deckSchemas.ts
import { z } from 'zod';

// Schema for creating a deck
export const createDeckSchema = z.object({
    name: z.string().trim().min(1, 'Deck name is required').max(100),
    primary_language: z.string().optional().nullable(),
    secondary_language: z.string().optional().nullable(),
    is_bilingual: z.boolean().optional().default(false),
    // user_id will be added from the authenticated user in the action
});
export type CreateDeckInput = z.infer<typeof createDeckSchema>;

// Schema for updating a deck (all fields optional)
export const updateDeckSchema = createDeckSchema.partial();
export type UpdateDeckInput = z.infer<typeof updateDeckSchema>;
