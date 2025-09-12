"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { LogOut, Shield, FileText, ExternalLink, AlertTriangle, Trash2 } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/hooks/use-auth"
import { useSettings } from "@/providers/settings-provider"
import { useFeatureFlags } from "@/hooks/useFeatureFlags"
import { ChildModePasswordDialog } from "@/components/child-mode-password-dialog"
import { toast } from "sonner"
import type { AuthError } from "@supabase/supabase-js"
import { appLogger } from '@/lib/logger'

export default function ProfilePage() {
  const { user, signOut, loading: authLoading } = useAuth()
  const { settings, updateSettings } = useSettings()
  const { isChildMode } = useFeatureFlags()
  const router = useRouter()
  const [signOutLoading, setSignOutLoading] = useState(false)
  const [childModeLoading, setChildModeLoading] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const searchParams = useSearchParams()
  const [termsConsent, setTermsConsent] = useState(true) // Default to true for existing users
  const [ageConsent, setAgeConsent] = useState(true) // Default to true for existing users

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        const callbackUrl = encodeURIComponent('/profile');
        appLogger.info("Profile page: User not authenticated, redirecting to login.");
        router.push(`/login?callbackUrl=${callbackUrl}`);
      }
    }
  }, [authLoading, user, router]);

  const handleSignOut = async () => {
    setSignOutLoading(true)
    const { error } = await signOut()

    if (error) {
      appLogger.error("Error signing out:", error)
      if (error instanceof Error) {
        toast.error(error.message || "An unexpected error occurred during sign out.")
      } else {
        const errorMessage = (error as AuthError)?.message || "Sign out failed. Please try again.";
        toast.error(errorMessage)
      }
      setSignOutLoading(false)
    } else {
      toast.success("Signed out successfully.")
    }
  }

  const handleChildModeToggle = async (enabled: boolean) => {
    // If trying to disable child mode, show password dialog
    if (!enabled && isChildMode) {
      setShowPasswordDialog(true);
      return;
    }

    // If enabling child mode, proceed directly
    setChildModeLoading(true)
    try {
      const { error } = await updateSettings({ childModeEnabled: enabled })
      
      if (error) {
        appLogger.error("Error updating child mode:", error)
        toast.error("Failed to update Child Mode", { description: error })
      } else {
        const message = enabled 
          ? "Child Mode enabled. Advanced features are now restricted for safety."
          : "Child Mode disabled. All features are now available."
        toast.success(message)
        appLogger.info(`Child mode ${enabled ? 'enabled' : 'disabled'} for user ${user?.id}`)
      }
    } catch (error) {
      appLogger.error("Unexpected error updating child mode:", error)
      toast.error("Failed to update Child Mode", { description: "An unexpected error occurred." })
    } finally {
      setChildModeLoading(false)
    }
  }

  const handlePasswordVerified = async () => {
    // This is called after password verification succeeds
    setChildModeLoading(true)
    try {
      const { error } = await updateSettings({ childModeEnabled: false })
      
      if (error) {
        appLogger.error("Error disabling child mode after password verification:", error)
        toast.error("Failed to disable Child Mode", { description: error })
      } else {
        toast.success("Child Mode disabled. All features are now available.")
        appLogger.info(`Child mode disabled after password verification for user ${user?.id}`)
      }
    } catch (error) {
      appLogger.error("Unexpected error disabling child mode:", error)
      toast.error("Failed to disable Child Mode", { description: "An unexpected error occurred." })
    } finally {
      setChildModeLoading(false)
    }
  }

  // Loading/User checks (matching settings page style)
  if (authLoading) { return <div className="container mx-auto p-8">Loading Profile...</div>; }
  if (!user) { return <div className="container mx-auto p-8">Redirecting to login...</div>; }

  return (
    <div className="container mx-auto py-8">
      {/* Header (no back button) */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Profile</h1>
      </div>

      <Tabs defaultValue={searchParams?.get('tab') || "account"} className="w-full">
        <TabsList className={`grid w-full h-auto ${isChildMode ? 'grid-cols-2' : 'grid-cols-3'}`}>
          <TabsTrigger value="account" className="text-xs sm:text-sm">Account</TabsTrigger>
          <TabsTrigger value="child-mode" className="text-xs sm:text-sm">Child Mode</TabsTrigger>
          {!isChildMode && (
            <TabsTrigger value="legal" className="text-xs sm:text-sm">
              Legal
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="account" className="space-y-6 mt-6">
          {/* User Information Card */}
          <Card>
          <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Your account details and preferences</CardDescription>
          </CardHeader>
            <CardContent className="space-y-6">
              {/* Email */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right font-medium">Email</Label>
                <div className="col-span-3">
                  <p className="text-sm">{user.email}</p>
                </div>
              </div>
              
              <Separator />
              
              {/* User ID */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right font-medium">User ID</Label>
                <div className="col-span-3">
                  <p className="text-sm font-mono text-muted-foreground">{user.id}</p>
                </div>
              </div>
              
              <Separator />
              
              {/* Last Sign In */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right font-medium">Last Sign In</Label>
                <div className="col-span-3">
                  <p className="text-sm">
                {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "N/A"}
              </p>
                </div>
            </div>
          </CardContent>
          </Card>

          {/* Sign Out Card */}
          <Card>
            <CardHeader>
              <CardTitle>Account Actions</CardTitle>
              <CardDescription>Manage your account session</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium">Sign Out</h3>
                  <p className="text-sm text-muted-foreground">
                    Sign out of your account on this device
                  </p>
                </div>
                <Button 
                  variant="destructive" 
                  onClick={handleSignOut} 
                  disabled={signOutLoading}
                >
              <LogOut className="mr-2 h-4 w-4" />
              {signOutLoading ? "Signing out..." : "Sign Out"}
            </Button>
              </div>
            </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="child-mode" className="space-y-6 mt-6">
          {/* Child Mode Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="mr-2 h-5 w-5" />
                Child Mode
              </CardTitle>
              <CardDescription>
                Enable safe mode for children by restricting access to advanced features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <h3 className="font-medium">Child Mode</h3>
                  <p className="text-sm text-muted-foreground">
                    {isChildMode 
                      ? "Advanced features are currently restricted for safety" 
                      : "All features are available"
                    }
                  </p>
                </div>
                <Switch
                  id="child-mode"
                  checked={isChildMode}
                  onCheckedChange={handleChildModeToggle}
                  disabled={childModeLoading || !settings}
                  aria-label="Toggle Child Mode"
                />
              </div>
              
              {isChildMode && (
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <p className="text-sm text-orange-800 dark:text-orange-200 font-medium mb-2">
                    Child Mode is active. The following features are disabled:
                  </p>
                  <ul className="text-sm text-orange-700 dark:text-orange-300 ml-4 list-disc space-y-1">
                    <li>Settings page access</li>
                    <li>Deck editing functionality</li>
                    <li>Legal page access</li>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="legal" className="space-y-6 mt-6">
          {/* Legal Documents Card */}
        <Card>
          <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Legal Documents
              </CardTitle>
              <CardDescription>
                Important legal information and policies for StudyCards
              </CardDescription>
          </CardHeader>
            <CardContent className="space-y-4">
              {/* Essential Legal Documents */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Essential Documents</h4>
                <div className="grid gap-2">
                  <Link 
                    href="/legal/privacy-policy" 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <h5 className="font-medium">Privacy Policy</h5>
                      <p className="text-sm text-muted-foreground">How we protect and use your data</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </Link>
                  
                  <Link 
                    href="/legal/terms-of-service" 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <h5 className="font-medium">Terms of Service</h5>
                      <p className="text-sm text-muted-foreground">Rules and conditions for using StudyCards</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </Link>
                  
                  <Link 
                    href="/legal/children-privacy" 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <h5 className="font-medium">Children's Privacy</h5>
                      <p className="text-sm text-muted-foreground">Special protections for users under 16</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </div>
              </div>

              {/* Mandatory Consent */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Mandatory Approvals</h4>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="terms-consent"
                      checked={termsConsent}
                      onCheckedChange={(checked) => setTermsConsent(checked as boolean)}
                    />
                    <div className="space-y-1">
                      <Label 
                        htmlFor="terms-consent" 
                        className="text-sm leading-5 cursor-pointer"
                      >
                        I agree to the Terms of Service and Privacy Policy.
                      </Label>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="age-consent"
                      checked={ageConsent}
                      onCheckedChange={(checked) => setAgeConsent(checked as boolean)}
                    />
                    <div className="space-y-1">
                      <Label 
                        htmlFor="age-consent" 
                        className="text-sm leading-5 cursor-pointer"
                      >
                        I confirm that I am at least 16 years old. If my account is used by a child under 16, I am the parent or legal guardian and I give consent on their behalf.
                      </Label>
                    </div>
                  </div>
                </div>

                {(!termsConsent || !ageConsent) && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <h5 className="font-medium text-red-800 dark:text-red-200">Legal Consent Required</h5>
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                          Both consent items above must be checked to continue using StudyCards. 
                          Without proper legal consent, your account cannot remain active.
                        </p>
                        <div className="mt-3 space-x-2">
                          <Link href="/legal/account-removal?reason=consent">
                            <Button variant="destructive" size="sm">
                              Remove Account
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setTermsConsent(true);
                              setAgeConsent(true);
                            }}
                          >
                            Continue with Consent
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Additional Legal Information */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Additional Information</h4>
                <div className="grid gap-2">
                  <Link 
                    href="/legal/cookie-policy" 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <h5 className="font-medium">Cookie Policy</h5>
                      <p className="text-sm text-muted-foreground">How we use cookies and tracking</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </Link>
                  
                  <Link 
                    href="/legal/accessibility" 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <h5 className="font-medium">Accessibility Statement</h5>
                      <p className="text-sm text-muted-foreground">Our commitment to accessibility</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </Link>
                  
                  <Link 
                    href="/legal/contact" 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <h5 className="font-medium">Contact & Company Info</h5>
                      <p className="text-sm text-muted-foreground">Legal entity and contact information</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </Link>
                  
                  <Link 
                    href="/legal/refund-policy" 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <h5 className="font-medium">Refund & Cancellation Policy</h5>
                      <p className="text-sm text-muted-foreground">Payment and subscription policies</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </div>
              </div>

              <Separator />

              {/* Account Removal Section */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-destructive">Account Management</h4>
                <div className="p-4 border-destructive/20 border rounded-lg bg-destructive/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-destructive">Remove Account</h5>
                      <p className="text-sm text-muted-foreground">
                        Permanently delete your account and all associated data. This action cannot be undone.
                      </p>
                    </div>
                    <Link href="/legal/account-removal">
                      <Button variant="destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove Account
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
          </CardContent>
        </Card>
        </TabsContent>
      </Tabs>

      {/* Password verification dialog */}
      <ChildModePasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        onPasswordVerified={handlePasswordVerified}
      />
      </div>
  )
}

