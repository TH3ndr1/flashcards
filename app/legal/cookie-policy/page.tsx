import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { LegalPageWrapper } from '@/components/layout/LegalPageWrapper';

export default function CookiePolicyPage() {
  return (
    <LegalPageWrapper title="Cookie Policy">
        <Card>
          <CardHeader>
            <CardTitle>1. What Are Cookies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Cookies are small text files stored on your device when you visit websites or use applications. 
              They help us provide a better user experience and understand how our service is used.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Cookies We Use</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Essential Cookies</h4>
              <p>Required for basic functionality:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Authentication and login sessions</li>
                <li>Security and fraud prevention</li>
                <li>User preferences and settings</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Analytics Cookies</h4>
              <p>Help us understand app usage (anonymized):</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Page views and feature usage</li>
                <li>Performance monitoring</li>
                <li>Error tracking and debugging</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Managing Cookies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>You can control cookies through:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your browser settings</li>
              <li>Our cookie preferences (when available)</li>
              <li>Clearing your browser data</li>
            </ul>
            <p>
              Note: Disabling essential cookies may affect app functionality.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Children and Cookies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              We do not use tracking cookies for children under 16. Only essential cookies 
              required for app functionality are used for young users.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Contact Us</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              For questions about our cookie policy, contact us at info@provivo.be.
            </p>
          </CardContent>
        </Card>
    </LegalPageWrapper>
  );
}
