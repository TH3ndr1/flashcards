import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { LegalPageWrapper } from '@/components/layout/LegalPageWrapper';

export function PrivacyPolicyContent() {
  return (
    <>
        {/* Introduction */}
        <Card>
          <CardHeader>
            <CardTitle>1. Introduction</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Welcome to StudyCards, operated by <strong>Provivo BV</strong> (info@provivo.be), a company registered in Belgium.
            </p>
            <p>
              We are committed to protecting your personal data and privacy. This Privacy Policy explains how we collect, 
              use, and protect your information when you use our StudyCards application. We welcome children from 8 years 
              and older, with appropriate parental guidance and consent where required by law.
            </p>
            <p>
              This policy applies to all users of StudyCards, including children, parents, teachers, and other users.
            </p>
          </CardContent>
        </Card>

        {/* Data We Collect */}
        <Card>
          <CardHeader>
            <CardTitle>2. What Data We Collect</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Account Information</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Name and email address</li>
                <li>Age (for child protection compliance)</li>
                <li>Account preferences and settings</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Study Data</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Flashcards and decks you create</li>
                <li>Study progress and scores</li>
                <li>Learning statistics and performance data</li>
                <li>Study session information</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Technical Data</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>IP address and device information</li>
                <li>Browser type and version</li>
                <li>Usage patterns and app interactions</li>
                <li>Error logs and debugging information</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Why We Process Data */}
        <Card>
          <CardHeader>
            <CardTitle>3. Why We Process Your Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Learning & Progress Tracking</h4>
              <p>To provide personalized learning experiences and track your educational progress.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">App Improvement</h4>
              <p>To analyze usage patterns and improve our application features and performance.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Safety & Security</h4>
              <p>To prevent misuse, ensure platform safety, and provide technical support.</p>
            </div>
          </CardContent>
        </Card>

        {/* Legal Basis */}
        <Card>
          <CardHeader>
            <CardTitle>4. Legal Basis (EU GDPR)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Consent</h4>
              <p>For children under 16, we require parental consent where legally required.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Contract Performance</h4>
              <p>To provide account services and app functionality as agreed.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Legitimate Interest</h4>
              <p>For security, debugging, and improving our services.</p>
            </div>
          </CardContent>
        </Card>

        {/* Data Retention */}
        <Card>
          <CardHeader>
            <CardTitle>5. Data Retention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              We retain your personal data only as long as necessary for the purposes outlined in this policy:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Account data: While your account remains active</li>
              <li>Study data: While your account remains active</li>
              <li>Technical logs: Up to 12 months for debugging and security</li>
              <li>Deleted accounts: Data is permanently removed within 30 days</li>
            </ul>
          </CardContent>
        </Card>

        {/* Data Sharing */}
        <Card>
          <CardHeader>
            <CardTitle>6. Data Sharing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              We do not sell your personal data. We may share limited data with:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Hosting providers:</strong> For secure data storage and app functionality</li>
              <li><strong>Analytics services:</strong> For app improvement (anonymized data only)</li>
              <li><strong>Legal authorities:</strong> When required by law or to protect safety</li>
            </ul>
            <p>
              All third-party services are carefully selected and bound by appropriate data protection agreements.
            </p>
          </CardContent>
        </Card>

        {/* User Rights */}
        <Card>
          <CardHeader>
            <CardTitle>7. Your Rights (EU GDPR)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Rectification:</strong> Correct inaccurate or incomplete data</li>
              <li><strong>Erasure:</strong> Request deletion of your personal data</li>
              <li><strong>Data Portability:</strong> Export your data in a machine-readable format</li>
              <li><strong>Object:</strong> Object to certain types of data processing</li>
              <li><strong>Restrict Processing:</strong> Limit how we process your data</li>
            </ul>
            <p>
              To exercise these rights, contact us at info@provivo.be.
            </p>
          </CardContent>
        </Card>

        {/* Children's Privacy */}
        <Card>
          <CardHeader>
            <CardTitle>8. Children's Privacy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Minimum Age</h4>
              <p>StudyCards is designed for users 8 years and older.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Parental Rights</h4>
              <p>Parents and guardians can:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Request access to their child's data</li>
                <li>Request correction or deletion of their child's account</li>
                <li>Withdraw consent for data processing</li>
                <li>Enable "Child Mode" for additional safety restrictions</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Special Protections</h4>
              <p>
                We implement additional safeguards for children, including limited data collection, 
                no behavioral advertising, and enhanced security measures.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>9. Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Data Controller</h4>
              <p>
                Provivo BV<br />
                Email: info@provivo.be<br />
                Location: Belgium
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Data Protection Questions</h4>
              <p>
                For any questions about this Privacy Policy or your data rights, please contact us at info@provivo.be.
                We will respond to your inquiry within 30 days.
              </p>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="text-sm text-muted-foreground">
          <p>
            This Privacy Policy may be updated from time to time. We will notify users of any significant changes 
            through the app or by email. Continued use of StudyCards after changes constitutes acceptance of the 
            updated policy.
          </p>
        </div>
    </>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPageWrapper title="Privacy Policy">
      <PrivacyPolicyContent />
    </LegalPageWrapper>
  );
}
