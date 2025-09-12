"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { createBrowserClient } from '@supabase/ssr';
import { appLogger } from '@/lib/logger';
import { toast } from 'sonner';

interface ChildModePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPasswordVerified: () => void;
}

/**
 * Password verification dialog for disabling child mode.
 * 
 * This component requires users to enter their current password before
 * allowing them to disable child mode, providing an additional security layer.
 */
export function ChildModePasswordDialog({
  open,
  onOpenChange,
  onPasswordVerified,
}: ChildModePasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      toast.error('Please enter your password');
      return;
    }

    if (!user?.email) {
      toast.error('User email not found');
      return;
    }

    setIsVerifying(true);

    try {
      // Create a new Supabase client for password verification
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Attempt to sign in with the current user's email and provided password
      // This will verify the password without actually signing in again
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      });

      if (error) {
        appLogger.warn('Password verification failed:', error.message);
        toast.error('Incorrect password. Please try again.');
        setPassword(''); // Clear the password field
        return;
      }

      // Password is correct
      appLogger.info('Password verified successfully for child mode disable');
      toast.success('Password verified successfully');
      
      // Reset form state
      setPassword('');
      setShowPassword(false);
      onOpenChange(false);
      
      // Call the success callback
      onPasswordVerified();

    } catch (error) {
      appLogger.error('Unexpected error during password verification:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCancel = () => {
    setPassword('');
    setShowPassword(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Disable Child Mode
          </DialogTitle>
          <DialogDescription>
            For security reasons, please enter your password to disable Child Mode.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Current Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isVerifying}
                className="pr-10"
                autoComplete="current-password"
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isVerifying}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              <strong>Security Notice:</strong> This password verification ensures that only
              authorized users can disable Child Mode and regain access to advanced features.
            </p>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isVerifying}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isVerifying || !password.trim()}
            >
              {isVerifying ? 'Verifying...' : 'Verify & Disable'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
