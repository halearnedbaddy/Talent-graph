import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Zap } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <header className="px-4 lg:px-6 h-14 flex items-center border-b">
        <Link href="/" className="flex items-center justify-center" prefetch={false}>
          <Zap className="h-6 w-6" />
          <span className="sr-only">Verve & Vigor</span>
        </Link>
      </header>
      <main className="flex-1 py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="mx-auto max-w-3xl space-y-6">
             <Button variant="ghost" size="sm" asChild>
                <Link href="/signup">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Sign Up
                </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl">Privacy Policy</h1>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Effective Date: {today}</p>
              <p>Last Updated: {today}</p>
            </div>
            <div className="space-y-8 text-muted-foreground">
              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">1. Introduction</h2>
                <p>This Privacy Policy explains how verve vigor inc (“Company,” “we,” “our,” or “us”) collects, uses, discloses, and safeguards personal data when you use our sports talent intelligence platform (the “Platform”).</p>
                <p className="mt-2">The Platform enables:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Athletes to create performance profiles</li>
                  <li>Scouts to evaluate and connect with athletes</li>
                  <li>Clubs to view athletes through affiliated scouts</li>
                  <li>Role-based, private access to performance analytics</li>
                </ul>
                <p className="mt-2">This Platform is not a public marketplace and does not allow unrestricted public browsing of athlete profiles.</p>
                <p className="mt-2">By using the Platform, you agree to this Privacy Policy.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">2. Who We Are</h2>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Legal Entity: verve vigor inc</li>
                  <li>Registered Address: jkuat entry road juja kiambu kenya</li>
                  <li>Contact Email: billionaireomenda@gmail.com</li>
                  <li>Jurisdiction: Kenya</li>
                </ul>
                <p className="mt-2">If you are located in the European Economic Area (EEA) or the United Kingdom, we act as the data controller for personal data processed through the Platform.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">3. Data We Collect</h2>
                <p>We collect personal data depending on your role (Athlete, Scout, Club Member).</p>
                <div className="space-y-4 mt-2">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">3.1 Athlete Data</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Full name</li>
                      <li>Date of birth / age</li>
                      <li>Contact details (email, phone if provided)</li>
                      <li>Position and sport</li>
                      <li>Performance metrics (e.g., speed, agility, endurance, strength)</li>
                      <li>Uploaded media (e.g., video clips, images)</li>
                      <li>Talent Scores and derived analytics</li>
                      <li>Recruitment stage status</li>
                      <li>Communication logs with scouts</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">3.2 Scout Data</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Full name</li>
                      <li>Contact information</li>
                      <li>Club affiliation</li>
                      <li>Professional information</li>
                      <li>Athlete connection history</li>
                      <li>Activity and performance metrics within the Platform</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">3.3 Club Member Data</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Name</li>
                      <li>Role within club (admin or scout)</li>
                      <li>Club information</li>
                      <li>Recruitment stage updates</li>
                      <li>Club-visible notes</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">3.4 Technical & Usage Data</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>IP address</li>
                      <li>Device and browser type</li>
                      <li>Log data</li>
                      <li>Session data</li>
                      <li>Cookies and similar technologies</li>
                      <li>Security monitoring data</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">4. How We Use Personal Data</h2>
                <p>We process personal data for the following purposes:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>To operate and maintain the Platform</li>
                  <li>To create and manage user accounts</li>
                  <li>To calculate and display Talent Scores</li>
                  <li>To enable scout–athlete connections</li>
                  <li>To enable club dashboards and analytics</li>
                  <li>To enforce role-based access controls</li>
                  <li>To monitor for fraud, misuse, or security risks</li>
                  <li>To comply with legal obligations</li>
                  <li>To improve platform functionality</li>
                </ul>
                <p className="mt-2 font-semibold">We do not sell personal data.</p>
                <p className="mt-2 font-semibold">We do not monetize athlete data through advertising.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">5. Legal Bases for Processing (EEA & UK Users)</h2>
                <p>Where applicable, we rely on:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Consent (e.g., athlete profile creation)</li>
                  <li>Contractual necessity (to provide Platform services)</li>
                  <li>Legitimate interests (platform security, analytics, fraud prevention)</li>
                  <li>Legal obligations (regulatory compliance)</li>
                </ul>
                <p className="mt-2">Where processing is based on consent, users may withdraw consent at any time.</p>
              </section>
              
              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">6. Data Sharing & Disclosure</h2>
                <p>We limit access to personal data strictly by role.</p>
                <div className="space-y-4 mt-2">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground mb-1">6.1 Within the Platform</h3>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Athlete data is visible only to connected scouts.</li>
                            <li>Club administrators can view athlete data only through affiliated scouts.</li>
                            <li>No cross-club access is permitted.</li>
                            <li>No public profile directory exists.</li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-foreground mb-1">6.2 Service Providers</h3>
                        <p>We may share data with:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Cloud hosting providers</li>
                            <li>Database infrastructure providers</li>
                            <li>Security monitoring providers</li>
                            <li>Analytics providers</li>
                        </ul>
                        <p className="mt-2">All service providers are contractually obligated to protect personal data.</p>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-foreground mb-1">6.3 Legal Disclosure</h3>
                        <p>We may disclose personal data if required by law, court order, or regulatory authority.</p>
                    </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">7. Data Retention</h2>
                <p>We retain personal data:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>For as long as the account remains active</li>
                  <li>For a reasonable period after account deletion (for legal and security purposes)</li>
                  <li>In backups for a limited retention period</li>
                </ul>
                <p className="mt-2">Users may request deletion of their data, subject to legal obligations and legitimate business interests.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">8. User Rights</h2>
                <p>Depending on your jurisdiction, you may have the right to:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Access your personal data</li>
                  <li>Correct inaccurate data</li>
                  <li>Request deletion</li>
                  <li>Restrict processing</li>
                  <li>Object to processing</li>
                  <li>Request data portability</li>
                  <li>Withdraw consent</li>
                </ul>
                <p className="mt-2">Requests may be submitted to: billionaireomenda@gmail.com</p>
                <p className="mt-2">For California residents and similar jurisdictions, additional rights may apply under applicable privacy laws.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">9. Children and Minors</h2>
                <p>If the Platform allows users under the age of 18:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Parental or legal guardian consent may be required.</li>
                  <li>We implement additional safeguards for minor accounts.</li>
                  <li>We do not knowingly sell or commercially exploit minor data.</li>
                </ul>
                <p className="mt-2">If we discover that personal data of a minor was collected without proper authorization, we will take steps to delete such data.</p>
                <p className="mt-2">Parents or guardians may contact us to review or delete a minor’s account.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">10. International Data Transfers</h2>
                <p>Your data may be transferred to and processed in countries outside your residence.</p>
                <p className="mt-2">Where required, we implement appropriate safeguards, including:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Standard contractual clauses</li>
                  <li>Contractual data protection obligations</li>
                  <li>Secure hosting environments</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">11. Security Measures</h2>
                <p>We implement reasonable technical and organizational safeguards, including:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Encryption in transit (HTTPS)</li>
                  <li>Role-based access controls</li>
                  <li>Authentication mechanisms</li>
                  <li>Secure hosting environments</li>
                  <li>Monitoring for unauthorized access</li>
                </ul>
                <p className="mt-2">However, no system can guarantee absolute security.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">12. Talent Score & Automated Processing</h2>
                <p>The Platform generates Talent Scores based on performance metrics submitted by athletes and/or scouts.</p>
                <p className="mt-2">These scores are:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Algorithmically derived</li>
                  <li>Intended for informational purposes</li>
                  <li>Not guarantees of selection, recruitment, or professional advancement</li>
                </ul>
                <p className="mt-2">Users may request clarification regarding how scores are calculated.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">13. Account Deletion</h2>
                <p>Users may request account deletion by contacting: billionaireomenda@gmail.com</p>
                <p className="mt-2">Upon deletion:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Profile access is revoked</li>
                  <li>Data may be retained for legal, fraud prevention, or contractual purposes</li>
                  <li>Certain records may remain in secure backups for a limited time</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">14. Changes to This Policy</h2>
                <p>We may update this Privacy Policy periodically.</p>
                <p className="mt-2">We will notify users of material changes through:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Platform notifications</li>
                  <li>Email (if applicable)</li>
                </ul>
                <p className="mt-2">Continued use of the Platform after updates constitutes acceptance.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">15. Contact Information</h2>
                <p>For privacy-related inquiries, contact:</p>
                <ul className="list-none mt-2 space-y-1">
                  <li>verve vigor inc</li>
                  <li>billionaireomenda@gmail.com</li>
                  <li>jkuat entry road juja kiambu kenya</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
