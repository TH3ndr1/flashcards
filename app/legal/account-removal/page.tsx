"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { LegalPageWrapper } from '@/components/layout/LegalPageWrapper';
import { useAuth } from '@/hooks/use-auth';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

export default function AccountRemovalPage() {
  const { user, signIn } = useAuth();
  const searchParams = useSearchParams();
  const isConsentWithdrawal = searchParams?.get('reason') === 'consent';
  const [confirmationText, setConfirmationText] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'confirmation' | 'password'>('confirmation');

  const handleConfirmationSubmit = () => {
    if (confirmationText.trim() === 'Remove Account') {
      setStep('password');
    } else {
      toast.error('Please type "Remove Account" exactly as shown.');
    }
  };

  const handlePasswordSubmit = async () => {
    if (!user?.email || !password) {
      toast.error('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      // Verify password by attempting to sign in
      const { error } = await signIn(user.email, password);
      
      if (error) {
        toast.error('Incorrect password. Please try again.');
        setLoading(false);
        return;
      }

      // Password verified - proceed with account removal
      toast.success('Account removal initiated. Your account will be permanently deleted.');
      
      // Account deletion logic would be implemented here
      // This includes:
      // 1. Cancel any active subscriptions
      // 2. Schedule immediate data deletion
      // 3. Send confirmation email
      // 4. Sign out user
      
    } catch (error) {
      console.error('Error during password verification:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LegalPageWrapper 
      title="Account Removal" 
      subtitle={isConsentWithdrawal 
        ? "Remove your StudyCards account due to consent withdrawal"
        : "Remove your StudyCards account permanently"
      }
    >
        {/* Consent Withdrawal Warning Card - Only shown for consent withdrawal */}
        {isConsentWithdrawal && (
          <>
            <Card className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
              <CardHeader>
                <CardTitle className="flex items-center text-red-800 dark:text-red-200">
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  Legal Consent Required
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-red-700 dark:text-red-300">
                  You have indicated that you cannot provide the required legal consent to use StudyCards. 
                  Without proper consent, we cannot legally maintain your account.
                </p>
                <div className="space-y-2">
                  <p className="text-red-700 dark:text-red-300 font-medium">
                    Account removal will result in:
                  </p>
                  <ul className="list-disc pl-6 space-y-1 text-red-700 dark:text-red-300">
                    <li>Permanent deletion of all your flashcards and study progress</li>
                    <li>Cancellation of any active subscriptions (if applicable)</li>
                    <li>Loss of access to your account and all associated data</li>
                    <li>This action cannot be undone</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Alternative Option */}
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-blue-800 dark:text-blue-200">
                  Alternative: Provide Consent
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-blue-700 dark:text-blue-300">
                  If you can provide the required legal consent, you can return to your profile 
                  and check the consent boxes to continue using StudyCards normally.
                </p>
                <Link href="/profile?tab=legal">
                  <Button variant="outline" className="w-full">
                    Return to Profile & Provide Consent
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Separator />
          </>
        )}

        {/* Regular Account Removal Warning - Only shown for regular removal */}
        {!isConsentWithdrawal && (
          <>
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800">
              <CardHeader>
                <CardTitle className="flex items-center text-orange-800 dark:text-orange-200">
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  Permanent Account Removal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-orange-700 dark:text-orange-300">
                  You are about to permanently remove your StudyCards account. This action cannot be undone.
                </p>
                <div className="space-y-2">
                  <p className="text-orange-700 dark:text-orange-300 font-medium">
                    Account removal will result in:
                  </p>
                  <ul className="list-disc pl-6 space-y-1 text-orange-700 dark:text-orange-300">
                    <li>Permanent deletion of all your flashcards and study progress</li>
                    <li>Cancellation of any active subscriptions (if applicable)</li>
                    <li>Loss of access to your account and all associated data</li>
                    <li>This action cannot be undone</li>
                  </ul>
                </div>
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-blue-700 dark:text-blue-300 text-sm">
                    <strong>Need help instead?</strong> If you're having issues with StudyCards, 
                    consider contacting our support team before removing your account.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Separator />
          </>
        )}

        {/* Account Removal Process */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trash2 className="mr-2 h-5 w-5 text-red-600" />
              Proceed with Account Removal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 'confirmation' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="confirmation">
                    Type "Remove Account" to confirm you understand this action is permanent:
                  </Label>
                  <Input
                    id="confirmation"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder="Remove Account"
                    className="mt-2"
                  />
                </div>
                <Button
                  onClick={handleConfirmationSubmit}
                  variant="destructive"
                  className="w-full"
                  disabled={confirmationText.trim() !== 'Remove Account'}
                >
                  Continue to Password Verification
                </Button>
              </div>
            )}

            {step === 'password' && (
              <div className="space-y-4">
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                    Final Step: Password Verification
                  </p>
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                    Enter your password to verify your identity before account removal.
                  </p>
                </div>

                <div>
                  <Label htmlFor="password">Enter your current password:</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    className="mt-2"
                  />
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={handlePasswordSubmit}
                    variant="destructive"
                    className="w-full"
                    disabled={!password || loading}
                  >
                    {loading ? 'Verifying...' : 'Remove Account Permanently'}
                  </Button>
                  <Button
                    onClick={() => setStep('confirmation')}
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                  >
                    Go Back
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
    </LegalPageWrapper>
  );
}
