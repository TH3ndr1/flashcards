import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Examination placeholder page component.
 * 
 * This page serves as a placeholder for the upcoming Examination feature,
 * displaying a coming soon message with an appropriate icon.
 * 
 * @returns {JSX.Element} The Examination placeholder page
 */
export default function ExaminationPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        {/* Examination Icon SVG */}
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
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10,9 9,9 8,9" />
            <circle cx="12" cy="15" r="1" />
            <circle cx="12" cy="11" r="1" />
          </svg>
        </div>

        {/* Content Card */}
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Examination Mode</CardTitle>
            <CardDescription>
              Test your knowledge with formal assessments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                We're working hard to bring you comprehensive examination features including:
              </p>
              <ul className="mt-3 text-sm text-muted-foreground space-y-1">
                <li>• Timed assessments</li>
                <li>• Multiple choice questions</li>
                <li>• Detailed performance analytics</li>
                <li>• Progress tracking</li>
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
