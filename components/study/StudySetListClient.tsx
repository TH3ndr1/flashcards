"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Edit, Terminal } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Tables } from '@/types/database';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StudyModeButtons } from '@/components/study/StudyModeButtons';

// Type for the study set data
type StudySet = Tables<'study_sets'>;

interface StudySetListClientProps {
  initialData?: StudySet[];
}

export function StudySetListClient({ initialData = [] }: StudySetListClientProps) {
  const [studySets] = useState<StudySet[]>(initialData);
  const isLoading = false; // No loading state needed with server-side data
  const error = null; // No error state needed with server-side data

  // Render empty state if no study sets
  if (studySets.length === 0) {
    return (
      <p className="text-center text-muted-foreground mt-10">You haven't created any smart playlists yet.</p>
    );
  }

  // Render the study sets grid
  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {studySets.map((set) => (
          <Card key={set.id} className="hover:shadow-md transition-shadow flex flex-col bg-gradient-to-b from-slate-100/40 dark:from-slate-800/40 to-transparent">
            <CardHeader className="pt-4 pb-2 space-y-1 px-4">
              <div className="flex justify-between items-center">
                <CardTitle className="truncate" title={set.name}>{set.name}</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 flex-shrink-0 text-muted-foreground" 
                      aria-label={`Edit ${set.name}`}
                      asChild
                    >
                      <Link href={`/study/sets/${set.id}/edit`}> 
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Edit Playlist</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <CardDescription>
                {set.description || `Updated ${formatDistanceToNow(new Date(set.updated_at), { addSuffix: true })}`}
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-end items-center mt-auto pt-4">
              <StudyModeButtons
                studyType="studySet"
                contentId={set.id}
                size="sm"
              />
            </CardFooter>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
} 