'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TagManager } from '@/components/tags/TagManager'; // Adjust path if needed
import { ArrowLeft } from 'lucide-react';

export default function ManageTagsPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl">
       <div className="flex items-center mb-6">
          {/* Assuming a general dashboard or settings page exists at / */}
          <Button variant="outline" size="icon" asChild className="mr-4">
             <Link href="/" aria-label="Back to Dashboard">
                <ArrowLeft className="h-5 w-5" />
             </Link>
          </Button>
          <h1 className="text-2xl font-bold">Manage Tags</h1>
       </div>

       <TagManager />
    </div>
  );
} 