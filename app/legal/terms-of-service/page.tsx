import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { LegalPageWrapper } from '@/components/layout/LegalPageWrapper';

export function TermsOfServiceContent() {
  return (
    <>
        {/* Introduction */}
        <Card>
          <CardHeader>
            <CardTitle>1. Introduction</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Welcome to StudyCards, a learning application operated by <strong>Provivo BV</strong>, Belgium. 
              These Terms of Service ("Terms") govern your use of our StudyCards application and services.
            </p>
            <p>
              StudyCards is designed for learners of all ages, with special considerations for children aged 8 and above. 
              By using our service, you agree to these Terms.
            </p>
            <p>
              If you are under 18 years old, please ensure your parent or guardian has reviewed and agrees to these Terms.
            </p>
          </CardContent>
        </Card>

        {/* Use of StudyCards */}
        <Card>
          <CardHeader>
            <CardTitle>2. Use of StudyCards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Minimum Age Requirements</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Minimum age: 8 years old</li>
                <li>Ages 8-15: Parental supervision recommended</li>
                <li>Ages 16+: Can use independently with parental awareness</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Acceptable Use</h4>
              <p>You may use StudyCards to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Create and study flashcards for educational purposes</li>
                <li>Track your learning progress</li>
                <li>Share appropriate educational content</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Prohibited Use</h4>
              <p>You must NOT:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Share inappropriate, harmful, or illegal content</li>
                <li>Attempt to hack, reverse engineer, or exploit the application</li>
                <li>Create multiple accounts to circumvent restrictions</li>
                <li>Use the service for commercial purposes without permission</li>
                <li>Violate intellectual property rights of others</li>
                <li>Harass, bully, or harm other users</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Content Ownership */}
        <Card>
          <CardHeader>
            <CardTitle>3. Content Ownership</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Your Content</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>You retain ownership of flashcards and content you create</li>
                <li>You grant StudyCards permission to store and display your content</li>
                <li>You are responsible for ensuring your content doesn't violate others' rights</li>
                <li>You can delete your content at any time</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">StudyCards Property</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>The StudyCards application, software, and brand are owned by Provivo BV</li>
                <li>All app features, design, and functionality are protected by copyright</li>
                <li>You may not copy, modify, or distribute our software</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Liability */}
        <Card>
          <CardHeader>
            <CardTitle>4. Liability and Disclaimers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Service "As Is"</h4>
              <p>
                StudyCards is provided "as is" without warranties of any kind. While we strive for accuracy and 
                reliability, we cannot guarantee the service will be error-free or always available.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Educational Purpose</h4>
              <p>
                StudyCards is a learning tool. We do not guarantee specific educational outcomes or results. 
                Learning success depends on individual effort and circumstances.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Limitation of Liability</h4>
              <p>
                To the maximum extent permitted by law, Provivo BV shall not be liable for any indirect, 
                incidental, or consequential damages arising from your use of StudyCards.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Future Payments */}
        <Card>
          <CardHeader>
            <CardTitle>5. Future Payment Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              StudyCards may introduce paid subscription features in the future. When this occurs:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Pricing and payment terms will be clearly displayed</li>
              <li>Free features will remain available to all users</li>
              <li>Subscribers will have access to premium features</li>
              <li>Billing will be handled through secure payment processors</li>
              <li>Users can cancel subscriptions at any time</li>
            </ul>
            <p>
              We will provide advance notice before introducing any paid features.
            </p>
          </CardContent>
        </Card>

        {/* Account Termination */}
        <Card>
          <CardHeader>
            <CardTitle>6. Account Termination</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">User Termination</h4>
              <p>You may delete your account at any time through the app settings or by contacting us.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Service Termination</h4>
              <p>We may suspend or terminate accounts that:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Violate these Terms of Service</li>
                <li>Engage in harmful or illegal activities</li>
                <li>Pose security risks to other users</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Data After Termination</h4>
              <p>
                When an account is terminated, user data will be permanently deleted within 30 days, 
                except where retention is required by law.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Governing Law */}
        <Card>
          <CardHeader>
            <CardTitle>7. Governing Law</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              These Terms are governed by the laws of Belgium and the European Union. Any disputes will be 
              resolved in accordance with Belgian law.
            </p>
            <p>
              For users outside the EU, local consumer protection laws may also apply where they provide 
              greater protection.
            </p>
          </CardContent>
        </Card>

        {/* Changes to Terms */}
        <Card>
          <CardHeader>
            <CardTitle>8. Changes to Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              We may update these Terms from time to time. When we do:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>We will notify users through the app or by email</li>
              <li>The updated Terms will be posted with a new "Last updated" date</li>
              <li>Continued use of StudyCards constitutes acceptance of the new Terms</li>
              <li>If you disagree with changes, you may terminate your account</li>
            </ul>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>9. Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              If you have questions about these Terms of Service, please contact us:
            </p>
            <div className="bg-muted p-4 rounded-lg">
              <p>
                <strong>Provivo BV</strong><br />
                Email: info@provivo.be<br />
                Location: Belgium
              </p>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="text-sm text-muted-foreground">
          <p>
            By using StudyCards, you acknowledge that you have read, understood, and agree to be bound by these 
            Terms of Service. If you do not agree to these Terms, please do not use our service.
          </p>
        </div>
    </>
  );
}

export default function TermsOfServicePage() {
  return (
    <LegalPageWrapper title="Terms of Service">
      <TermsOfServiceContent />
    </LegalPageWrapper>
  );
}
