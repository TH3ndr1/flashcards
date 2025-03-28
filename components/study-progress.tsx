// src/components/study/study-progress.tsx
import { Progress } from "@/components/ui/progress";

interface StudyProgressProps {
    totalCorrect: number;
    totalRequired: number;
    overallPercent: number;
    masteredCount: number;
    totalCards: number;
    masteryPercent: number;
}

export function StudyProgress({
    totalCorrect,
    totalRequired,
    overallPercent,
    masteredCount,
    totalCards,
    masteryPercent
}: StudyProgressProps) {
    return (
        <div className="max-w-2xl mx-auto mb-8 space-y-4">
            <div>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-muted-foreground">
                        Overall Progress ({totalCorrect} / {totalRequired} answers)
                    </span>
                    <span className="text-sm font-medium">{overallPercent}%</span>
                </div>
                <Progress value={overallPercent} aria-label={`Overall progress: ${overallPercent}%`} className="h-2" />
            </div>
            <div>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-muted-foreground">
                        Cards Mastered ({masteredCount} / {totalCards} cards)
                    </span>
                    <span className="text-sm font-medium">{masteryPercent}%</span>
                </div>
                <Progress value={masteryPercent} aria-label={`Cards mastered: ${masteryPercent}%`} className="h-2" />
            </div>
        </div>
    );
}

// Optionally use export default if preferred
// export default StudyProgress;