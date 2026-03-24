// components/story/StoryGenerateModal.tsx
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useSettings } from '@/providers/settings-provider';
import { useStoryStore } from '@/store/storyStore';
import { toast } from 'sonner';
import { appLogger } from '@/lib/logger';
import type { ReadingTimeMin, Story } from '@/types/story';
import { BookOpen, Loader2 } from 'lucide-react';

interface StoryGenerateModalProps {
  deckId: string;
  deckName: string;
  isOpen: boolean;
  onClose: () => void;
}

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function StoryGenerateModal({ deckId, deckName, isOpen, onClose }: StoryGenerateModalProps) {
  const router = useRouter();
  const { settings, updateSettings } = useSettings();
  const setCurrentStory = useStoryStore((s) => s.setCurrentStory);

  const [readingTime, setReadingTime] = useState<ReadingTimeMin>(10);
  const [dobInput, setDobInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const hasDob = !!settings?.dateOfBirth;
  const age = useMemo(() => {
    const dob = settings?.dateOfBirth || dobInput;
    return dob ? calculateAge(dob) : null;
  }, [settings?.dateOfBirth, dobInput]);

  const canGenerate = hasDob ? true : !!dobInput;

  const handleGenerate = async () => {
    if (!canGenerate || age === null) return;

    setIsGenerating(true);

    try {
      // Save DOB to profile if it wasn't saved yet
      if (!hasDob && dobInput) {
        const { error: dobError } = await updateSettings({ dateOfBirth: dobInput });
        if (dobError) {
          toast.error('Failed to save date of birth', { description: dobError });
          setIsGenerating(false);
          return;
        }
      }

      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckId, readingTimeMin: readingTime, age }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const msg = json.message || 'Failed to generate story.';
        toast.error('Story generation failed', { description: msg });
        appLogger.error('[StoryGenerateModal] API error:', msg);
        return;
      }

      const story = json.story as Story;
      setCurrentStory(story, deckName, deckId, window.location.pathname);
      onClose();
      router.push(`/practice/story/${deckId}`);
    } catch (err) {
      appLogger.error('[StoryGenerateModal] Unexpected error:', err);
      toast.error('Something went wrong generating the story.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Generate Story
          </DialogTitle>
          <DialogDescription>
            Create an AI-generated story based on <strong>{deckName}</strong> to help you understand the material.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Reading time selector */}
          <div className="space-y-2">
            <Label>Reading time</Label>
            <ToggleGroup
              type="single"
              value={String(readingTime)}
              onValueChange={(v) => { if (v) setReadingTime(Number(v) as ReadingTimeMin); }}
              className="justify-start"
            >
              <ToggleGroupItem value="5" className="px-4">5 min</ToggleGroupItem>
              <ToggleGroupItem value="10" className="px-4">10 min</ToggleGroupItem>
              <ToggleGroupItem value="20" className="px-4">20 min</ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* DOB section */}
          {hasDob ? (
            <div className="space-y-1">
              <Label>Age</Label>
              <p className="text-sm text-muted-foreground">
                Story complexity tailored for age <strong>{age}</strong>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="dob-input">Date of birth</Label>
              <Input
                id="dob-input"
                type="date"
                value={dobInput}
                onChange={(e) => setDobInput(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-muted-foreground">
                Your date of birth personalises the story&apos;s complexity. It will be saved to your profile.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating || !canGenerate}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <BookOpen className="mr-2 h-4 w-4" />
                Generate Story
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
