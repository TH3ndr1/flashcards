import React from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface PageHeadingProps {
  title: string;
  description?: string;
  backHref?: string;
}

export function PageHeading({ title, description, backHref }: PageHeadingProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center">
        {backHref && (
          <Link 
            href={backHref} 
            className="mr-4 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      </div>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
} 