'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStudySets } from '@/hooks/useStudySets';
import { useStudySessionStore, StudyInput } from '@/store/studySessionStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from 'sonner';
import { Edit, Play, BookOpen, GraduationCap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Tables } from '@/types/database';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Terminal } from "lucide-react"
import { cn } from "@/lib/utils";

// Define DbStudySet using Tables
type DbStudySet = Tables<'study_sets'>;

export default function ListStudySetsPage() {
  const router = useRouter();
  const { studySets, isLoading, error } = useStudySets();
  const setStudyParameters = useStudySessionStore((state) => state.setStudyParameters);

  const handleStudy = (studySetId: string, mode: 'learn' | 'review') => {
    console.log(`[ListStudySetsPage] Starting session for Set ID: ${studySetId}, Mode: ${mode}`);
    const actionInput: StudyInput = { studySetId: studySetId };
    setStudyParameters(actionInput, mode);
    router.push('/study/session');
  };

  // --- Render Logic ---

  return (
    <TooltipProvider>
      <div className="py-4 px-4 md:p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Your Smart Playlists</h1>
          <Button asChild>
            <Link href="/study/sets/new">Create New Playlist</Link>
          </Button>
        </div>

        {isLoading && (
          <div className="flex justify-center items-center h-40">
             Loading playlists...
          </div>
        )}

        {error && (
           <Alert variant="destructive"><Terminal className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
        )}

        {!isLoading && !error && studySets.length === 0 && (
          <p className="text-center text-muted-foreground mt-10">You haven't created any smart playlists yet.</p>
        )}

        {!isLoading && !error && studySets.length > 0 && (
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
                   <div className="flex gap-3">
                      <Button 
                          onClick={() => handleStudy(set.id, 'learn')} 
                          aria-label={`Learn ${set.name}`}
                          className="h-9 px-3 text-sm bg-gradient-to-br from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white"
                      >
                         <GraduationCap className="h-4 w-4 mr-1" /> Learn
                      </Button>
                      <Button 
                          onClick={() => handleStudy(set.id, 'review')} 
                          aria-label={`Review ${set.name}`}
                          className="h-9 px-3 text-sm bg-gradient-to-br from-blue-500 to-sky-500 hover:from-blue-600 hover:to-sky-600 text-white"
                      >
                         <Play className="h-4 w-4 mr-1" /> Review
                      </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
} 