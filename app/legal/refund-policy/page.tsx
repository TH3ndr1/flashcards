import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CreditCard, RefreshCw } from 'lucide-react';
import { LegalPageWrapper } from '@/components/layout/LegalPageWrapper';

export default function RefundPolicyPage() {
  return (
    <LegalPageWrapper 
      title="Refund & Cancellation Policy" 
      subtitle="Payment and subscription policies"
    >
        {/* Current Status */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-800 dark:text-blue-200">
              <CreditCard className="mr-2 h-5 w-5" />
              Current Service Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-blue-700 dark:text-blue-300">
              <strong>StudyCards is currently free to use.</strong> This refund policy will apply when we 
              introduce paid subscription features in the future. We will notify all users in advance 
              before implementing any paid services.
            </p>
          </CardContent>
        </Card>

        {/* Future Subscription Terms */}
        <Card>
          <CardHeader>
            <CardTitle>1. Future Subscription Services</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              When StudyCards introduces premium features, we will offer:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Monthly and annual subscription options</li>
              <li>Clear pricing displayed before purchase</li>
              <li>Free trial periods where applicable</li>
              <li>Core features will remain free for all users</li>
            </ul>
          </CardContent>
        </Card>

        {/* EU Right of Withdrawal */}
        <Card>
          <CardHeader>
            <CardTitle>2. Right of Withdrawal (EU Consumers)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">14-Day Withdrawal Period</h4>
              <p>EU consumers have the right to withdraw from purchases within 14 days without giving a reason.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Digital Services Exception</h4>
              <p>
                For digital services that begin immediately with your explicit consent, 
                the withdrawal right may be waived once service delivery has started.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">How to Exercise Withdrawal</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Email us at info@provivo.be</li>
                <li>Include your account details and purchase information</li>
                <li>Clearly state your intention to withdraw</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Cancellation */}
        <Card>
          <CardHeader>
            <CardTitle>3. Subscription Cancellation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">How to Cancel</h4>
              <p>You will be able to cancel your subscription:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Through your account settings in the app</li>
                <li>By contacting our support team</li>
                <li>Through the payment provider's portal</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">When Cancellation Takes Effect</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Cancellation is effective at the end of your current billing period</li>
                <li>You retain access to premium features until the period ends</li>
                <li>No additional charges will occur after cancellation</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Refund Process */}
        <Card>
          <CardHeader>
            <CardTitle>4. Refund Process</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Eligible Refunds</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>EU consumers within 14-day withdrawal period</li>
                <li>Technical issues preventing service use</li>
                <li>Billing errors or duplicate charges</li>
                <li>Unauthorized charges</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Refund Timeline</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Refund requests processed within 5 business days</li>
                <li>Refunds issued to original payment method</li>
                <li>Bank processing may take 3-10 additional business days</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Special Considerations for Children */}
        <Card>
          <CardHeader>
            <CardTitle>5. Purchases by Minors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Parental Authorization</h4>
              <p>
                Purchases by users under 18 require parental authorization. Parents can:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Request refunds for unauthorized purchases by minors</li>
                <li>Cancel subscriptions initiated by their children</li>
                <li>Set up parental controls for future purchases</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Verification Process</h4>
              <p>
                We may require verification of parental relationship and identity 
                for refund requests involving minor accounts.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Non-Refundable Items */}
        <Card>
          <CardHeader>
            <CardTitle>6. Non-Refundable Services</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>The following services may not be eligible for refunds:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Services fully consumed or used</li>
              <li>Promotional or discounted subscriptions (unless required by law)</li>
              <li>Gift subscriptions after delivery</li>
            </ul>
            <p>
              Consumer protection laws may override these limitations in your jurisdiction.
            </p>
          </CardContent>
        </Card>

        {/* Contact for Refunds */}
        <Card>
          <CardHeader>
            <CardTitle>7. Requesting a Refund</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <p className="font-semibold text-green-800 dark:text-green-200">Refund Requests:</p>
              <p className="text-green-700 dark:text-green-300">
                <strong>Email:</strong> info@provivo.be<br />
                <strong>Subject:</strong> "Refund Request - [Your Account Email]"<br />
                <strong>Response Time:</strong> Within 2 business days
              </p>
            </div>
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Include in Your Request</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Account email address</li>
                <li>Purchase date and amount</li>
                <li>Reason for refund request</li>
                <li>Payment method used</li>
                <li>Any relevant screenshots or documentation</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Important Notice</h3>
          <p className="text-yellow-700 dark:text-yellow-300">
            This policy will be updated when paid services are introduced. We will provide at least 
            30 days' notice before implementing any paid features, and existing users will have the 
            opportunity to review updated terms before any charges apply.
          </p>
        </div>
    </LegalPageWrapper>
  );
}
