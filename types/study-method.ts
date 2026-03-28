/**
 * Study Method Types
 * Defines the core types for the universal study method card system
 */

export type StudyMethodType = 
  | 'flashcard' 
  | 'story' 
  | 'quiz' 
  | 'mindmap' 
  | 'knowledge-graph';

export type StoryFormat = 
  | 'story'
  | 'overview'
  | 'dialogue'
  | 'analogies';

export interface StudyMethodMetadata {
  // Common metadata for all methods
  id: string;
  title: string;
  methodType: StudyMethodType;
  
  // Progress tracking
  totalItems: number;
  completedItems: number;
  dueItems: number;
  
  // Language/locale information
  sourceLanguage?: string;
  targetLanguage?: string;
  
  // Tags and categorization
  tags?: string[];
  
  // Color-coded progress segments (for visualization)
  progressSegments?: {
    completed: number; // percentage
    learning: number; // percentage
    new: number; // percentage
  };
  
  // Method-specific metadata
  methodSpecific?: FlashcardMetadata | StoryMetadata | QuizMetadata | MindMapMetadata | KnowledgeGraphMetadata;
}

// Method-specific metadata interfaces
export interface FlashcardMetadata {
  cardsDue: number;
  reviewStreak?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface StoryMetadata {
  chapters: number;
  currentChapter: number;
  readingTime?: number; // in minutes
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  format?: StoryFormat;
}

export interface QuizMetadata {
  questions: number;
  accuracy?: number; // percentage
  lastScore?: number;
  timeLimit?: number; // in minutes
}

export interface MindMapMetadata {
  nodes: number;
  connections: number;
  depth: number; // levels deep
  coverage?: number; // percentage of nodes mastered
}

export interface KnowledgeGraphMetadata {
  concepts: number;
  relationships: number;
  clusters: number;
  masteryLevel?: number; // 0-100
}