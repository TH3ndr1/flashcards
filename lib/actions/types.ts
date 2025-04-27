/**
 * Defines common types used across server actions.
 */

/**
 * Represents the outcome of a server action.
 * 
 * @template T The type of the data returned on success.
 */
export interface ActionResult<T> {
    data: T | null;
    error: string | null; // Consistent error type (string message)
} 