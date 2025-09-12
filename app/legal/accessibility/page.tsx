import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Heart } from 'lucide-react';
import { LegalPageWrapper } from '@/components/layout/LegalPageWrapper';

export default function AccessibilityPage() {
  return (
    <LegalPageWrapper 
      title="Accessibility Statement" 
      subtitle="Our commitment to inclusive learning"
    >
        <Card>
          <CardHeader>
            <CardTitle>1. Our Commitment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              StudyCards is committed to making our learning platform accessible to everyone, including 
              children and adults with learning differences, visual impairments, motor difficulties, 
              and other disabilities.
            </p>
            <p>
              We believe that quality education should be available to all learners, regardless of their abilities.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Accessibility Standards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              We strive to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards, 
              which include:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Perceivable content for all users</li>
              <li>Operable interface elements</li>
              <li>Understandable information and navigation</li>
              <li>Robust content that works with assistive technologies</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Accessibility Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Visual Accessibility</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>High contrast color options</li>
                <li>Adjustable font sizes</li>
                <li>OpenDyslexic and Atkinson Hyperlegible font options</li>
                <li>Clear visual indicators and focus states</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Motor Accessibility</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Full keyboard navigation support</li>
                <li>Large, easy-to-click buttons</li>
                <li>Customizable interface layouts</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Cognitive Accessibility</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Simple, consistent navigation</li>
                <li>Clear language and instructions</li>
                <li>Progress indicators and feedback</li>
                <li>Spaced repetition learning system</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Assistive Technology</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Screen reader compatibility</li>
                <li>Proper heading structure and landmarks</li>
                <li>Alt text for images and icons</li>
                <li>ARIA labels and descriptions</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Known Limitations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              We are continuously working to improve accessibility. Current areas for improvement include:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Enhanced voice control support</li>
              <li>More comprehensive keyboard shortcuts</li>
              <li>Additional language support for screen readers</li>
              <li>Improved mobile accessibility features</li>
            </ul>
            <p>
              We are actively working on these improvements and welcome your feedback.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Feedback and Support</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              If you encounter accessibility barriers while using StudyCards, please let us know:
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="font-semibold text-blue-800 dark:text-blue-200">Accessibility Support:</p>
              <p className="text-blue-700 dark:text-blue-300">
                <strong>Email:</strong> info@provivo.be<br />
                <strong>Subject:</strong> "Accessibility Support"<br />
                <strong>Response Time:</strong> Within 48 hours
              </p>
            </div>
            <p className="mt-4">
              Please include details about:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>The accessibility barrier you encountered</li>
              <li>Your device and assistive technology used</li>
              <li>The specific feature or page affected</li>
              <li>Suggestions for improvement</li>
            </ul>
          </CardContent>
        </Card>

        <Separator />

        <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg border border-purple-200 dark:border-purple-800">
          <h3 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">Continuous Improvement</h3>
          <p className="text-purple-700 dark:text-purple-300">
            Accessibility is an ongoing journey, not a destination. We regularly review and update our 
            platform to ensure it remains accessible to all learners. Your feedback helps us identify 
            areas for improvement and prioritize accessibility enhancements.
          </p>
        </div>
    </LegalPageWrapper>
  );
}
