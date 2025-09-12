import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Shield } from 'lucide-react';
import { LegalPageWrapper } from '@/components/layout/LegalPageWrapper';

export default function ChildrenPrivacyPage() {
  return (
    <LegalPageWrapper 
      title="Children's Privacy" 
      subtitle="Special protections for young learners"
    >
        {/* Introduction */}
        <Card>
          <CardHeader>
            <CardTitle>1. Our Commitment to Children's Safety</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              At StudyCards, we take the privacy and safety of children very seriously. This Children's Privacy Notice 
              explains how we handle personal information from users under 16 years old, in compliance with GDPR 
              (European Union) and COPPA (United States) regulations.
            </p>
            <p>
              We welcome young learners aged 8 and above, with appropriate safeguards and parental involvement 
              where required by law.
            </p>
          </CardContent>
        </Card>

        {/* Age Requirements */}
        <Card>
          <CardHeader>
            <CardTitle>2. Age Requirements and Parental Consent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Age Groups</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Ages 8-12:</strong> Parental consent required, Child Mode recommended</li>
                <li><strong>Ages 13-15:</strong> Parental awareness required, Child Mode available</li>
                <li><strong>Ages 16+:</strong> Can consent independently under GDPR</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Parental Consent Process</h4>
              <p>For children under 16 (or local age of digital consent), we require:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Parent or guardian email verification</li>
                <li>Explicit consent for data collection and use</li>
                <li>Ongoing ability to review and control the child's account</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Data Collection from Children */}
        <Card>
          <CardHeader>
            <CardTitle>3. Data We Collect from Children</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Essential Information Only</h4>
              <p>We collect only the minimum data necessary for educational functionality:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Child's first name or chosen username</li>
                <li>Parent/guardian email address (for communication)</li>
                <li>Age range (for appropriate content and safety measures)</li>
                <li>Educational content created by the child (flashcards, study progress)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">What We Don't Collect</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Full names or detailed personal information</li>
                <li>Precise location data</li>
                <li>Photos or videos of the child</li>
                <li>Social media profiles or contacts</li>
                <li>Behavioral data for advertising purposes</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* How We Use Children's Data */}
        <Card>
          <CardHeader>
            <CardTitle>4. How We Use Children's Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Educational Purposes Only</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Providing personalized learning experiences</li>
                <li>Tracking educational progress and achievements</li>
                <li>Ensuring age-appropriate content and features</li>
                <li>Providing technical support when needed</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Safety and Security</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Protecting against inappropriate content</li>
                <li>Preventing misuse of the platform</li>
                <li>Implementing Child Mode restrictions when activated</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Parental Rights */}
        <Card>
          <CardHeader>
            <CardTitle>5. Parental Rights and Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Rights Under GDPR and COPPA</h4>
              <p>Parents and guardians have the right to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Review:</strong> Access all data collected about their child</li>
                <li><strong>Correct:</strong> Update or correct inaccurate information</li>
                <li><strong>Delete:</strong> Request permanent deletion of their child's account and data</li>
                <li><strong>Control:</strong> Withdraw consent and stop further data collection</li>
                <li><strong>Export:</strong> Receive a copy of their child's data</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">How to Exercise These Rights</h4>
              <p>Parents can contact us at info@provivo.be with:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Proof of parental relationship</li>
                <li>Child's username or account information</li>
                <li>Specific request (review, correct, delete, etc.)</li>
              </ul>
              <p>We will respond within 30 days and may request additional verification for security.</p>
            </div>
          </CardContent>
        </Card>

        {/* Child Mode Features */}
        <Card>
          <CardHeader>
            <CardTitle>6. Child Mode Safety Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Enhanced Protection</h4>
              <p>When Child Mode is enabled:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Access to advanced settings is restricted</li>
                <li>Deck editing capabilities are limited</li>
                <li>Additional content filtering is applied</li>
                <li>Password protection prevents unauthorized changes</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Parental Control</h4>
              <p>Parents can:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Enable or disable Child Mode remotely</li>
                <li>Monitor their child's learning progress</li>
                <li>Receive notifications about account activity</li>
                <li>Set study time limits and schedules</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* No Marketing to Children */}
        <Card>
          <CardHeader>
            <CardTitle>7. No Marketing or Advertising to Children</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p><strong>Zero Tolerance Policy:</strong></p>
            <ul className="list-disc pl-6 space-y-1">
              <li>We do not show advertisements to users under 16</li>
              <li>We do not use children's data for marketing purposes</li>
              <li>We do not sell or share children's data with advertisers</li>
              <li>We do not track children for behavioral advertising</li>
            </ul>
            <p>
              Our focus is purely educational, providing a safe learning environment without commercial distractions.
            </p>
          </CardContent>
        </Card>

        {/* Data Security */}
        <Card>
          <CardHeader>
            <CardTitle>8. Data Security for Children</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Enhanced Security Measures</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Encrypted data storage and transmission</li>
                <li>Regular security audits and updates</li>
                <li>Limited access to children's data within our team</li>
                <li>Automatic logout after periods of inactivity</li>
                <li>Secure hosting with GDPR-compliant providers</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Incident Response</h4>
              <p>
                In the unlikely event of a data breach affecting children's data, we will notify parents 
                within 72 hours and provide detailed information about steps taken to protect their child.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contact for Parents */}
        <Card>
          <CardHeader>
            <CardTitle>9. Contact Information for Parents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Dedicated Parent Support</h4>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="font-semibold text-blue-800 dark:text-blue-200">For All Child Privacy Matters:</p>
                <p className="text-blue-700 dark:text-blue-300">
                  <strong>Email:</strong> info@provivo.be<br />
                  <strong>Subject Line:</strong> "Child Privacy - [Your Child's Username]"<br />
                  <strong>Response Time:</strong> Within 24 hours for urgent matters
                </p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">What to Include in Your Message</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Your relationship to the child</li>
                <li>Child's username or account identifier</li>
                <li>Specific concern or request</li>
                <li>Preferred method of response</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border border-green-200 dark:border-green-800">
          <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">Our Promise to Families</h3>
          <p className="text-green-700 dark:text-green-300">
            We are committed to providing a safe, educational environment for children. We will never compromise 
            on child safety for business purposes. If you have any concerns about your child's privacy or safety 
            while using StudyCards, please contact us immediately.
          </p>
        </div>
    </LegalPageWrapper>
  );
}
