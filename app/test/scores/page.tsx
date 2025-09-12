import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Scores placeholder page component.
 * 
 * This page serves as a placeholder for the upcoming Scores feature,
 * displaying a coming soon message with an appropriate icon.
 * 
 * @returns {JSX.Element} The Scores placeholder page
 */
export default function ScoresPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        {/* Scores Icon SVG */}
        <div className="w-24 h-24 text-muted-foreground">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-full h-full"
          >
            <path d="M3 3v18h18" />
            <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
            <circle cx="7" cy="14" r="1" />
            <circle cx="11" cy="11" r="1" />
            <circle cx="13" cy="10" r="1" />
            <circle cx="18" cy="8" r="1" />
            <path d="M9 21v-6" />
            <path d="M15 21v-8" />
            <path d="M12 21v-4" />
            <path d="M6 21v-2" />
          </svg>
        </div>

        {/* Content Card */}
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Performance Scores</CardTitle>
            <CardDescription>
              Track your learning progress and achievements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                We're developing comprehensive scoring features including:
              </p>
              <ul className="mt-3 text-sm text-muted-foreground space-y-1">
                <li>• Detailed performance metrics</li>
                <li>• Progress visualization charts</li>
                <li>• Achievement badges</li>
                <li>• Historical score tracking</li>
                <li>• Comparative analytics</li>
              </ul>
            </div>
            <p className="text-lg font-medium text-primary">
              Coming Soon!
            </p>
            <p className="text-sm text-muted-foreground">
              This feature will be available in an upcoming release. Stay tuned for updates!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
