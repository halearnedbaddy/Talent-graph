import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Briefcase, Users, Code, ShieldCheck, ArrowRight, Monitor, Database, Terminal } from 'lucide-react';
import { Header } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';

const jobs = [
  {
    id: 'admin-operations',
    title: 'Platform Operations Admin',
    department: 'Operations',
    location: 'Remote / Kenya',
    type: 'Full-time',
    description: 'Help manage the professional integrity of the Talent Graph. Responsible for verification management and user safety.',
    link: '/jobs/admin/signup',
    icon: ShieldCheck,
    action: 'Apply Now'
  },
  {
    id: 'software-developer',
    title: 'Software Developer',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    description: 'Generalist engineer to work across our product suite, building intuitive tools for athletes and scouts.',
    link: 'mailto:vervevigor.co@gmail.com?subject=Application: Software Developer',
    icon: Terminal,
    action: 'Email Resume'
  },
  {
    id: 'frontend-developer',
    title: 'Frontend Developer',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    description: 'Expert in React and Next.js to craft high-performance, accessible, and beautiful sports analytics interfaces.',
    link: 'mailto:vervevigor.co@gmail.com?subject=Application: Frontend Developer',
    icon: Monitor,
    action: 'Email Resume'
  },
  {
    id: 'backend-developer',
    title: 'Backend Developer',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    description: 'Focus on scaling our Firestore architecture, Genkit AI flows, and real-time data processing engines.',
    link: 'mailto:vervevigor.co@gmail.com?subject=Application: Backend Developer',
    icon: Database,
    action: 'Email Resume'
  },
  {
    id: 'scout-partnerships',
    title: 'Institutional Scout Liaison',
    department: 'Partnerships',
    location: 'Remote',
    type: 'Contract',
    description: 'Onboard and support professional scouting organizations and clubs globally.',
    link: '#',
    icon: Users,
    action: 'Join Waitlist'
  },
  {
    id: 'data-scientist',
    title: 'Sports Data Scientist',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    description: 'Refine our CSI and Talent Scoring algorithms to provide the most accurate athletic evaluations.',
    link: '#',
    icon: Code,
    action: 'Join Waitlist'
  }
];

export default function JobsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Join the Movement</h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              We are building the professional identity layer for global sport. Join us in creating a more transparent and meritocratic scouting ecosystem.
            </p>
          </div>

          <div className="grid gap-6 max-w-4xl mx-auto">
            {jobs.map((job) => (
              <Card key={job.id} className="hover:shadow-md transition-shadow group">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10 text-primary">
                    <job.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{job.title}</CardTitle>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-1 rounded">
                        {job.type}
                      </span>
                    </div>
                    <CardDescription>{job.department} &bull; {job.location}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-6">{job.description}</p>
                  <Button asChild className="w-full sm:w-auto">
                    <Link href={job.link}>
                      {job.action}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-24 bg-muted/50 rounded-2xl p-8 md:p-12 text-center max-w-4xl mx-auto border border-dashed">
            <Briefcase className="w-12 h-12 text-primary/20 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4">Don't see a fit?</h2>
            <p className="text-muted-foreground mb-8">
              We are always looking for passionate sports professionals and engineers. Send your resume to <span className="font-bold text-foreground">vervevigor.co@gmail.com</span> for future consideration.
            </p>
            <Button variant="outline" asChild>
                <a href="mailto:vervevigor.co@gmail.com?subject=General Inquiry: Careers">General Inquiry</a>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
