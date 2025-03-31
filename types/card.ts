export interface Card {
    id: string;
    deck_id: string;
    front: string;
    back: string;
    tags?: string[];
    created_at: string;
    updated_at: string;
    user_id: string;
    
    // SRS fields
    last_reviewed_at?: string;
    next_review_due?: string;
    srs_level?: number;
    easiness_factor?: number;
    interval_days?: number;
    stability?: number;
    difficulty?: number;
    last_review_grade?: number;
    correct_count?: number;
    incorrect_count?: number;
} 