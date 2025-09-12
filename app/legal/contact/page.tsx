import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Building, Mail, MapPin } from 'lucide-react';
import { LegalPageWrapper } from '@/components/layout/LegalPageWrapper';

export default function ContactPage() {
  return (
    <LegalPageWrapper 
      title="Contact & Company Information" 
      subtitle="Legal entity and contact details"
    >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building className="mr-2 h-5 w-5" />
              Company Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2">Legal Entity</h4>
                <p><strong>Company Name:</strong> Provivo BV</p>
                <p><strong>Legal Form:</strong> Private Limited Company (BV)</p>
                <p><strong>Country of Registration:</strong> Belgium</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Business Details</h4>
                <p><strong>VAT Number:</strong> BE0789250002</p>
                <p><strong>Company Registration:</strong>0789250002</p>
                <p><strong>Industry:</strong> Educational Technology</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="mr-2 h-5 w-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2">General Contact</h4>
                <div className="space-y-2">
                  <p><strong>Email:</strong> info@provivo.be</p>
                  <p><strong>Response Time:</strong> Within 3 working days</p>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Specialized Support</h4>
                <div className="space-y-2">
                  <p><strong>Privacy Matters:</strong> info@provivo.be</p>
                  <p><strong>Child Safety:</strong> info@provivo.be</p>
                  <p><strong>Accessibility:</strong> info@provivo.be</p>
                  <p><strong>Technical Support:</strong> info@provivo.be</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MapPin className="mr-2 h-5 w-5" />
              Business Address
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="font-semibold">Provivo BV</p>
              <p>[Business Address]</p>
              <p>[Postal Code] [City]</p>
              <p>Belgium</p>
            </div>
            <p className="text-sm text-muted-foreground">
              This address is for legal correspondence only. For all support and general inquiries, 
              please use our email contact information above.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Regulatory Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">EU Compliance</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>General Data Protection Regulation (GDPR) compliant</li>
                <li>eCommerce Directive requirements met</li>
                <li>Consumer rights protection (EU Consumer Law)</li>
                <li>Digital Services Act compliance (when applicable)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">International Compliance</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Children's Online Privacy Protection Act (COPPA) - US</li>
                <li>Family Educational Rights and Privacy Act (FERPA) - US</li>
                <li>Personal Information Protection and Electronic Documents Act (PIPEDA) - Canada</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Protection Officer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              For all data protection and privacy matters, you can contact our Data Protection Officer:
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p><strong>DPO Contact:</strong> info@provivo.be</p>
              <p><strong>Subject Line:</strong> "Data Protection Officer - [Your Request]"</p>
              <p><strong>Response Time:</strong> Within 30 days (or sooner for urgent matters)</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dispute Resolution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Internal Resolution</h4>
              <p>
                We encourage users to contact us directly for any concerns or disputes. 
                We are committed to resolving issues fairly and promptly.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">External Authorities</h4>
              <p>If you are not satisfied with our response, you may contact:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Belgium:</strong> Data Protection Authority (APD/GBA)</li>
                <li><strong>EU:</strong> Your local data protection authority</li>
                <li><strong>Consumer Rights:</strong> Your local consumer protection agency</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="text-center text-muted-foreground">
          <p>
            This contact information is provided in compliance with EU eCommerce Directive requirements 
            and other applicable laws. For the most up-to-date contact information, please refer to this page.
          </p>
        </div>
    </LegalPageWrapper>
  );
}
