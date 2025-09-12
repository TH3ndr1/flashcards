"use client";

import { ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface LegalDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Legal Document Modal Component
 * 
 * Displays legal documents in a modal overlay during signup flow.
 * This prevents navigation away from the signup form while allowing
 * users to review legal content.
 */
export function LegalDocumentModal({ 
  isOpen, 
  onClose, 
  title, 
  children 
}: LegalDocumentModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Last updated: September 12, 2025
            </p>
            {children}
          </div>
        </div>
        
        <div className="border-t p-6">
          <Button onClick={onClose} className="w-full">
            Close and Continue Signup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
