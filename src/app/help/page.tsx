
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Zap, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const HelpSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <section className="mb-12">
    <h2 className="text-2xl font-semibold text-foreground mb-6 pb-2 border-b">{title}</h2>
    <div className="space-y-8">
      {children}
    </div>
  </section>
);

const HelpItem = ({ question, children }: { question: string, children: React.ReactNode }) => (
  <div>
    <h3 className="text-lg font-semibold text-foreground mb-2">{question}</h3>
    <div className="prose prose-stone dark:prose-invert text-muted-foreground space-y-4">
      {children}
    </div>
  </div>
);


export default function HelpCenterPage() {
  return (
    <div className="flex flex-col min-h-[100dvh]">
      <header className="px-4 lg:px-6 h-14 flex items-center border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container mx-auto flex items-center justify-between">
           <Link href="/" className="flex items-center justify-center" prefetch={false}>
             <Zap className="h-6 w-6" />
             <span className="ml-2 font-semibold text-lg">Talent Graph</span>
           </Link>
           <Button variant="outline" size="sm" asChild>
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Home
                </Link>
            </Button>
        </div>
      </header>
      <main className="flex-1 py-12 md:py-24">
        <div className="container px-4 md:px-6">
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">Help Centre</h1>
                <p className="mt-4 text-lg text-muted-foreground">
                    This page answers common questions about how the Platform works for Athletes, Scouts, and Clubs.
                </p>
                <p className="mt-2 text-muted-foreground">
                    If you cannot find what you need, contact us at: <a href="mailto:billionaireomenda@gmail.com" className="text-primary underline">billionaireomenda@gmail.com</a> or call <a href="tel:+254727946012" className="text-primary underline">+254 727 946 012</a>
                </p>
            </div>
            
            <div className="space-y-12">
                <HelpSection title="For Athletes">
                    <HelpItem question="1. How do I create a profile?">
                        <p>After registering:</p>
                        <ul className="list-disc pl-5">
                            <li>Complete your personal details.</li>
                            <li>Enter your performance metrics.</li>
                            <li>Upload any relevant media (if enabled).</li>
                            <li>Submit your profile.</li>
                        </ul>
                        <p>Your profile becomes visible only to scouts who connect with you. There is no public athlete directory.</p>
                    </HelpItem>
                    <HelpItem question="2. Who can see my profile?">
                        <p>Your profile is visible only to:</p>
                        <ul className="list-disc pl-5">
                            <li>Scouts who have connected with you.</li>
                            <li>Clubs affiliated with those scouts (via their internal dashboard).</li>
                        </ul>
                        <p>Other clubs cannot access your data unless connected through a scout.</p>
                    </HelpItem>
                    <HelpItem question="3. What is a Talent Score?">
                         <p>Your Talent Score is an algorithmically generated rating based on:</p>
                        <ul className="list-disc pl-5">
                            <li>Performance metrics</li>
                            <li>Position-specific benchmarks</li>
                            <li>Normalized scoring models</li>
                        </ul>
                        <p>It is informational and does not guarantee recruitment or selection.</p>
                    </HelpItem>
                    <HelpItem question="4. Can I edit my performance data?">
                        <p>Yes. You can update your metrics at any time from your profile dashboard. Updates may affect your Talent Score.</p>
                    </HelpItem>
                    <HelpItem question="5. How do I delete my account?">
                        <p>You may request account deletion by contacting: <a href="mailto:billionaireomenda@gmail.com" className="text-primary underline">billionaireomenda@gmail.com</a>. Deletion requests are processed in accordance with our Privacy Policy.</p>
                    </HelpItem>
                </HelpSection>

                <HelpSection title="For Scouts">
                    <HelpItem question="6. How do I connect with an athlete?">
                        <p>Search or invite an athlete (if enabled). Send a connection request. Once accepted, the athlete becomes visible in your dashboard. Your affiliated club (if applicable) can view connected athletes.</p>
                    </HelpItem>
                     <HelpItem question="7. How does the recruitment stage work?">
                        <p>Each athlete can be assigned a recruitment stage, such as:</p>
                        <ul className="list-disc pl-5">
                            <li>Discovered</li>
                            <li>Shortlisted</li>
                            <li>Trial</li>
                            <li>Offer</li>
                            <li>Signed</li>
                            <li>Rejected</li>
                        </ul>
                        <p>Stages help organize your pipeline. Club admins may also update stages.</p>
                    </HelpItem>
                     <HelpItem question="8. Can I see athletes from other clubs?">
                        <p>No. You can only see:</p>
                        <ul className="list-disc pl-5">
                            <li>Athletes you have connected with.</li>
                            <li>Athletes assigned to you within your affiliated club.</li>
                        </ul>
                        <p>Cross-club visibility is restricted.</p>
                    </HelpItem>
                     <HelpItem question="9. What happens if I leave a club?">
                        <p>If you are removed from a club, you lose access to that club’s dashboard. Access to athlete data may be restricted depending on your role status. Contact support for clarification.</p>
                    </HelpItem>
                </HelpSection>

                 <HelpSection title="For Clubs">
                    <HelpItem question="10. How does the Club Dashboard work?">
                        <p>The dashboard aggregates all athletes connected by scouts within your club. Admins can:</p>
                        <ul className="list-disc pl-5">
                            <li>View all connected athletes.</li>
                            <li>Monitor recruitment stages.</li>
                            <li>Filter by scout, position, or score.</li>
                        </ul>
                         <p>Clubs cannot access a global athlete database.</p>
                    </HelpItem>
                    <HelpItem question="11. How do I add scouts to my club?">
                        <p>Club admins can invite scouts via the Club Settings page. Once accepted, the scout’s athlete connections become visible within the club dashboard.</p>
                    </HelpItem>
                    <HelpItem question="12. Can clubs directly scout athletes?">
                        <p>No. Clubs access athletes through their affiliated scouts. This ensures structured, role-based visibility.</p>
                    </HelpItem>
                 </HelpSection>

                <HelpSection title="Technical & Account Support">
                    <HelpItem question="13. I forgot my password. What should I do?">
                        <p>Use the “Forgot Password” link on the login page to reset your credentials.</p>
                    </HelpItem>
                     <HelpItem question="14. I’m experiencing a technical issue.">
                        <p>If you encounter errors, please refresh the page, clear your browser cache, or try another browser. If the issue persists, contact: <a href="mailto:billionaireomenda@gmail.com" className="text-primary underline">billionaireomenda@gmail.com</a> or call <a href="tel:+254727946012" className="text-primary underline">+254 727 946 012</a> with:</p>
                        <ul className="list-disc pl-5">
                            <li>Your role (Athlete / Scout / Club)</li>
                            <li>Device type</li>
                            <li>Screenshot (if possible)</li>
                            <li>Description of the issue</li>
                        </ul>
                    </HelpItem>
                </HelpSection>

                 <HelpSection title="Privacy & Security">
                    <HelpItem question="15. Is my data secure?">
                        <p>We implement:</p>
                         <ul className="list-disc pl-5">
                            <li>Encrypted connections (HTTPS)</li>
                            <li>Role-based access controls</li>
                            <li>Secure hosting environments</li>
                        </ul>
                        <p>For more details, review our <Link href="/privacy-policy" className="text-primary underline">Privacy Policy</Link>.</p>
                    </HelpItem>
                 </HelpSection>
                 
                 <HelpSection title="Partnerships & Media">
                    <p className="text-muted-foreground">
                        For partnerships, enterprise onboarding, or media inquiries, contact: <a href="mailto:billionaireomenda@gmail.com" className="text-primary underline">billionaireomenda@gmail.com</a>
                    </p>
                 </HelpSection>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
