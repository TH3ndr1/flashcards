// app/decks/create-choice/page.tsx
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FilePlus, BotMessageSquare, PencilLine } from 'lucide-react'; // Added PencilLine
import { useRouter } from 'next/navigation';

export default function CreateChoicePage() {
    const router = useRouter();

    return (
        <div className="container mx-auto max-w-lg px-4 py-8">
            <Button variant="outline" size="sm" onClick={() => router.back()} className="mb-6">
                 <ArrowLeft className="mr-2 h-4 w-4" />
                 Back
            </Button>

            <h1 className="text-2xl font-bold mb-6 text-center">How would you like to create a deck?</h1>

            <div className="grid grid-cols-1 gap-6">
                {/* Option 1: Manual Creation */}
                <Link href="/manage/decks/new/manual" legacyBehavior>
                    <a className="block hover:no-underline">
                        <Card className="hover:border-primary hover:shadow-md transition-all cursor-pointer">
                            <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                <PencilLine className="h-8 w-8 text-primary" />
                                <div>
                                    <CardTitle>Create Manually</CardTitle>
                                    <CardDescription>Enter deck details and add cards yourself.</CardDescription>
                                </div>
                            </CardHeader>
                        </Card>
                    </a>
                </Link>

                {/* Option 2: AI from File/Image */}
                <Link href="/prepare/ai-generate" legacyBehavior>
                     <a className="block hover:no-underline">
                        <Card className="hover:border-primary hover:shadow-md transition-all cursor-pointer">
                             <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                <BotMessageSquare className="h-8 w-8 text-primary" /> {/* Using Bot icon */}
                                <div>
                                    <CardTitle>Generate from File / Image (AI)</CardTitle>
                                    <CardDescription>Upload documents or photos to automatically create flashcards.</CardDescription>
                                </div>
                             </CardHeader>
                         </Card>
                     </a>
                </Link>

                {/* Add more options here in the future */}
                {/* Example:
                <Card className="opacity-50 cursor-not-allowed">
                    <CardHeader className="flex flex-row items-center gap-4 pb-2">
                        <LinkIcon className="h-8 w-8 text-muted-foreground" />
                        <div>
                            <CardTitle>Create from URL (Coming Soon)</CardTitle>
                            <CardDescription>Paste a web link to generate cards.</CardDescription>
                        </div>
                    </CardHeader>
                </Card>
                */}
            </div>
        </div>
    );
}