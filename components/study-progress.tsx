// src/components/study/study-progress.tsx
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface StudyProgressProps {
    /** Current card number in the study queue */
    currentCardInQueue: number;
    /** Total number of cards in the study queue */
    totalCardsInQueue: number;
    /** SRS level counts for the current queue */
    srsLevels: {
        new: number;
        learning: number;
        review: number;
    };
}

export function StudyProgress({
    currentCardInQueue,
    totalCardsInQueue,
    srsLevels
}: StudyProgressProps) {
    // Calculate queue progress percentage
    const queueProgress = totalCardsInQueue > 0 
        ? Math.round((currentCardInQueue / totalCardsInQueue) * 100)
        : 0;

    // Calculate total cards for SRS distribution
    const totalSrsCards = srsLevels.new + srsLevels.learning + srsLevels.review;

    // Calculate percentages for SRS distribution
    const newPercent = totalSrsCards > 0 ? Math.round((srsLevels.new / totalSrsCards) * 100) : 0;
    const learningPercent = totalSrsCards > 0 ? Math.round((srsLevels.learning / totalSrsCards) * 100) : 0;
    const reviewPercent = totalSrsCards > 0 ? Math.round((srsLevels.review / totalSrsCards) * 100) : 0;

    return (
        <div className="max-w-2xl mx-auto mb-8 space-y-4">
            {/* Queue Progress */}
            <div>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-muted-foreground">
                        Queue Progress ({currentCardInQueue} / {totalCardsInQueue} cards)
                    </span>
                    <span className="text-sm font-medium">{queueProgress}%</span>
                </div>
                <Progress 
                    value={queueProgress} 
                    aria-label={`Queue progress: ${queueProgress}%`} 
                    className="h-2" 
                />
            </div>

            {/* SRS Distribution */}
            <div>
                <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                            SRS Distribution
                        </span>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[300px]">
                                    <p className="font-semibold mb-2">Spaced Repetition System (SRS) Levels:</p>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li><span className="text-blue-500 font-medium">New</span>: Cards you haven't studied yet</li>
                                        <li><span className="text-amber-500 font-medium">Learning</span>: Cards being actively learned (levels 1-3)</li>
                                        <li><span className="text-green-500 font-medium">Review</span>: Cards in long-term memory (level 4+)</li>
                                    </ul>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <div className="flex gap-4 text-xs">
                        <span className="text-blue-500">New: {srsLevels.new}</span>
                        <span className="text-amber-500">Learning: {srsLevels.learning}</span>
                        <span className="text-green-500">Review: {srsLevels.review}</span>
                    </div>
                </div>
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                    {/* New Cards (Blue) */}
                    <div 
                        className="absolute left-0 top-0 h-full bg-blue-500" 
                        style={{ width: `${newPercent}%` }}
                        aria-label={`New cards: ${srsLevels.new}`}
                    />
                    {/* Learning Cards (Amber) */}
                    <div 
                        className="absolute h-full bg-amber-500" 
                        style={{ left: `${newPercent}%`, width: `${learningPercent}%` }}
                        aria-label={`Learning cards: ${srsLevels.learning}`}
                    />
                    {/* Review Cards (Green) */}
                    <div 
                        className="absolute h-full bg-green-500" 
                        style={{ left: `${newPercent + learningPercent}%`, width: `${reviewPercent}%` }}
                        aria-label={`Review cards: ${srsLevels.review}`}
                    />
                </div>
            </div>
        </div>
    );
}

// Optionally use export default if preferred
// export default StudyProgress;