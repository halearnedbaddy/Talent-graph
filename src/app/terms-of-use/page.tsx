import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Zap } from 'lucide-react';

export default function TermsOfUsePage() {
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
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl">Terms of Use</h1>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Effective Date: {today}</p>
              <p>Last Updated: {today}</p>
            </div>
            <div className="space-y-8 text-muted-foreground">
                <p>These Terms of Use (“Terms”) govern access to and use of the platform operated by verve vigor inc (“Company,” “we,” “us,” or “our”).</p>
                <p>By creating an account or using the Platform, you agree to be bound by these Terms. If you do not agree, you must not use the Platform.</p>
              
              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">1. Platform Overview</h2>
                <p>The Platform is a private sports talent intelligence system that enables:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Athletes to create structured performance profiles</li>
                  <li>Scouts to evaluate and connect with athletes</li>
                  <li>Clubs to manage athlete pipelines through affiliated scouts</li>
                </ul>
                <p className="mt-2">The Platform is not:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>A public athlete marketplace</li>
                    <li>A job board</li>
                    <li>An agency</li>
                    <li>A guarantee of recruitment, trials, or contracts</li>
                </ul>
                <p className="mt-2">All scouting and recruitment decisions are made independently by users.</p>
              </section>
              
              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">2. Eligibility & Account Registration</h2>
                <p>To use the Platform:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>You must meet the minimum legal age in your jurisdiction.</li>
                  <li>If under 18, parental or guardian consent may be required.</li>
                  <li>You must provide accurate, complete, and current information.</li>
                  <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
                </ul>
                 <p className="mt-2">We may suspend or terminate accounts that contain false information.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">3. User Roles & Responsibilities</h2>
                <div className="space-y-4 mt-2">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">3.1 Athletes</h3>
                    <p>Athletes agree to:</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>Provide truthful performance metrics</li>
                        <li>Upload lawful and non-infringing content</li>
                        <li>Not misrepresent identity or achievements</li>
                        <li>Use the Platform solely for legitimate athletic exposure</li>
                    </ul>
                    <p className="mt-2">Athletes acknowledge that Talent Scores are informational and not guarantees of opportunity.</p>
                  </div>
                   <div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">3.2 Scouts</h3>
                    <p>Scouts agree to:</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>Use athlete data strictly for legitimate scouting purposes</li>
                        <li>Not redistribute athlete data outside the Platform without authorization</li>
                        <li>Not harass, exploit, or pressure athletes</li>
                        <li>Respect role-based access restrictions</li>
                    </ul>
                    <p className="mt-2">Misuse of athlete data may result in immediate termination.</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">3.3 Clubs</h3>
                    <p>Clubs are responsible for:</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>Conduct of their members</li>
                        <li>Proper handling of athlete information</li>
                        <li>Ensuring compliance with applicable laws</li>
                    </ul>
                    <p className="mt-2">Clubs may only access athlete data through affiliated scouts.</p>
                  </div>
                </div>
              </section>

               <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">4. Data Ownership & Intellectual Property</h2>
                 <div className="space-y-4 mt-2">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground mb-1">4.1 User Data</h3>
                        <p>Users retain ownership of personal data they submit.</p>
                        <p className="mt-2">By using the Platform, users grant the Company a limited license to process and display data as necessary to operate the Platform.</p>
                    </div>
                     <div>
                        <h3 className="text-lg font-semibold text-foreground mb-1">4.2 Platform Intellectual Property</h3>
                        <p>The Company owns:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>The Platform software and infrastructure</li>
                            <li>All algorithms and Talent Score models</li>
                            <li>Data architecture and system design</li>
                            <li>Branding and trademarks</li>
                            <li>Aggregated, anonymized analytics</li>
                        </ul>
                         <p className="mt-2 font-semibold">Talent Scores and derived analytics are proprietary intellectual property.</p>
                         <p className="mt-2">Users may not:</p>
                         <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Reverse engineer the Platform</li>
                            <li>Attempt to extract algorithm logic</li>
                            <li>Replicate the scoring methodology</li>
                         </ul>
                    </div>
                 </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">5. Talent Scores & Automated Processing</h2>
                <p>The Platform generates Talent Scores using submitted performance metrics and structured inputs.</p>
                <p className="mt-2">These scores:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Are algorithmically generated</li>
                  <li>Are informational only</li>
                  <li>Do not constitute professional evaluation certification</li>
                  <li>Do not guarantee recruitment outcomes</li>
                </ul>
                <p className="mt-2">Users understand that automated outputs may evolve over time.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">6. Prohibited Conduct</h2>
                 <p>Users may not:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Scrape, crawl, or extract Platform data</li>
                    <li>Bypass security controls</li>
                    <li>Impersonate another person</li>
                    <li>Harass or exploit other users</li>
                    <li>Upload unlawful, defamatory, or infringing content</li>
                    <li>Use the Platform for non-sport commercial exploitation</li>
                </ul>
                <p className="mt-2">Violations may result in suspension or legal action.</p>
              </section>
              
              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">7. Privacy</h2>
                <p>Use of the Platform is subject to our Privacy Policy, which explains how personal data is collected, used, and shared.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">8. Suspension & Termination</h2>
                 <p>We reserve the right to:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Suspend or terminate accounts for violations</li>
                    <li>Remove content that breaches these Terms</li>
                    <li>Restrict access to protect users or the Platform</li>
                </ul>
                <p className="mt-2">We may retain certain data after termination for legal and security purposes.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">9. Disclaimers</h2>
                <p>The Platform is provided on an “as is” and “as available” basis.</p>
                 <p className="mt-2">We do not warrant:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>That the Platform will be uninterrupted</li>
                    <li>That data will be error-free</li>
                    <li>That recruitment opportunities will result</li>
                </ul>
                <p className="mt-2">All scouting decisions are independent of the Company.</p>
              </section>
              
              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">10. Limitation of Liability</h2>
                 <p>To the fullest extent permitted by law:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>We are not liable for indirect, incidental, or consequential damages.</li>
                    <li>We are not responsible for recruitment outcomes.</li>
                    <li>Our total liability shall not exceed the amount paid to us (if any) in the previous 12 months.</li>
                </ul>
                <p className="mt-2">Some jurisdictions do not allow certain limitations; in such cases, liability is limited to the maximum extent permitted.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">11. Indemnification</h2>
                <p>You agree to indemnify and hold harmless the Company from claims arising from:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Your misuse of the Platform</li>
                    <li>Violation of these Terms</li>
                    <li>Infringement of third-party rights</li>
                    <li>Unauthorized sharing of athlete data</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">12. Governing Law & Dispute Resolution</h2>
                <p>These Terms are governed by the laws of Kenya, without regard to conflict of law principles.</p>
                <p className="mt-2">Disputes shall be resolved in the courts of Kenya, unless otherwise required by law.</p>
              </section>
              
              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">13. Modifications to Terms</h2>
                <p>We may update these Terms periodically.</p>
                <p className="mt-2">If changes are material, we will provide notice through:</p>
                 <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Platform notifications</li>
                    <li>Email (if available)</li>
                </ul>
                <p className="mt-2">Continued use after updates constitutes acceptance.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-2">14. Contact Information</h2>
                 <p>For legal inquiries regarding these Terms:</p>
                <ul className="list-none mt-2 space-y-1">
                    <li>verve vigor inc</li>
                    <li>jkuat entry road juja kiambu kenya</li>
                    <li>billionaireomenda@gmail.com</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
