
import Image from 'next/image';
import Link from 'next/link';
import {
  ShieldOff,
  Search,
  Zap,
  ShieldCheck,
  FileText,
  TrendingUp,
  Target,
  User,
  GitGraph,
  Medal,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Header } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';
import { PWAInstallButton } from '@/components/pwa-install-button';

export function LandingPage() {
  const heroImage = PlaceHolderImages.find((img) => img.id === 'hero-image');
  const athleteImage = PlaceHolderImages.find((img) => img.id === 'athlete-persona');
  const scoutImage = PlaceHolderImages.find((img) => img.id === 'scout-persona');

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative h-[80vh] min-h-[600px] flex items-center justify-center text-center text-white">
          {heroImage && (
            <Image
              src={heroImage.imageUrl}
              alt={heroImage.description}
              fill
              className="object-cover"
              priority
              data-ai-hint={heroImage.imageHint}
            />
          )}
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-10 container mx-auto px-4">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4">
              Your Professional Identity in Sports
            </h1>
            <p className="max-w-3xl mx-auto text-lg md:text-xl text-white/80 mb-8">
              The Talent Graph for athletes and scouts. Verified data, structured profiles, and long-term performance tracking.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" asChild className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                <Link href="/signup">Create Account</Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
              <PWAInstallButton className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm" />
            </div>
          </div>
        </section>

        {/* Problem Section */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-3xl md:text-4xl font-bold">The Challenge in Talent Discovery</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                The current landscape is noisy, unverifiable, and focused on short-term wins. This makes true talent hard to find and harder to develop.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="bg-secondary p-3 rounded-full">
                      <ShieldOff className="w-6 h-6 text-foreground" />
                    </div>
                    <CardTitle>Unverifiable Data</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Self-reported stats and highlight reels without context make it difficult to trust the data you see.
                  </CardDescription>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="bg-secondary p-3 rounded-full">
                      <Search className="w-6 h-6 text-foreground" />
                    </div>
                    <CardTitle>Signal vs. Noise</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Social media hype and a flood of information bury the athletes who consistently put in the work.
                  </CardDescription>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="bg-secondary p-3 rounded-full">
                      <Zap className="w-6 h-6 text-foreground" />
                    </div>
                    <CardTitle>Short-Term Focus</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    The system rewards flashes of brilliance over long-term consistency, missing out on late bloomers and disciplined grinders.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Solution Section */}
        <section className="py-16 md:py-24 bg-secondary">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-3xl md:text-4xl font-bold">The Solution: The Talent Graph</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                We're building a professional identity layer for sports, based on truth, structure, and a long-term perspective.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="bg-background">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="bg-primary text-primary-foreground p-3 rounded-full">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <CardTitle>Verified Metrics</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Integrate with trusted sources to provide verified performance data, creating a single source of truth.
                  </CardDescription>
                </CardContent>
              </Card>
              <Card className="bg-background">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="bg-primary text-primary-foreground p-3 rounded-full">
                      <FileText className="w-6 h-6" />
                    </div>
                    <CardTitle>Structured Profiles</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Move beyond the highlight reel with comprehensive profiles that showcase an athlete's full journey.
                  </CardDescription>
                </CardContent>
              </Card>
              <Card className="bg-background">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="bg-primary text-primary-foreground p-3 rounded-full">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <CardTitle>Long-Term Tracking</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Track progress over years, not just seasons, to identify trends and reward consistent improvement.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
        
        {/* How It Works Section */}
        <section className="py-16 md:py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold">How It Works</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                A clear path from creation to discovery.
              </p>
            </div>
            <div className="relative max-w-4xl mx-auto">
              <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-border md:-translate-x-1/2" />
              <div className="space-y-16">
                {[
                  { icon: User, title: 'Create Your Account', description: 'Establish your professional baseline. Secure your identity on the graph.' },
                  { icon: GitGraph, title: 'Build Your Profile', description: 'Connect your data sources and build a comprehensive record of your career.' },
                  { icon: TrendingUp, title: 'Track Your Performance', description: 'Watch your graph grow as you add new milestones and verified achievements.' },
                  { icon: Medal, title: 'Get Discovered', description: 'Scouts and organizations use the graph to find talent they can trust.' },
                ].map((step, index) => (
                  <div key={index} className="flex items-start md:items-center gap-6 md:gap-12">
                    <div className={`flex items-center gap-6 md:gap-12 md:w-1/2 ${index % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                      <div className="hidden md:block" />
                      <div className="md:text-right">
                        <div className={`inline-block bg-primary text-primary-foreground p-3 rounded-full mb-4 ${index % 2 === 0 ? 'md:float-right md:ml-4' : 'md:float-left md:mr-4'}`}>
                          <step.icon className="w-6 h-6"/>
                        </div>
                        <div className="flex-grow">
                          <h3 className="text-2xl font-semibold">{` ${step.title}`}</h3>
                          <p className="text-muted-foreground mt-2">{step.description}</p>
                        </div>
                      </div>
                    </div>
                     <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary ring-8 ring-background z-10"/>
                    <div className="hidden md:block w-1/2" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* User Persona Sections */}
        <section className="py-16 md:py-24 bg-secondary">
          <div className="container mx-auto px-4 grid md:grid-cols-2 gap-16 items-center">
            <div className="flex flex-col items-start">
              <div className="mb-4">
                <Target className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-3xl font-bold mb-4">For Athletes</h2>
              <p className="text-muted-foreground mb-6">Take control of your narrative. Build a professional identity that reflects your hard work and dedication, and connect with opportunities that value consistency.</p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-1" />
                  <span>Build credibility with a verified record of your achievements.</span>
                </li>
                <li className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-primary shrink-0 mt-1" />
                  <span>Showcase your long-term growth and commitment.</span>
                </li>
              </ul>
              <Button asChild>
                <Link href="/signup">Build Your Profile</Link>
              </Button>
            </div>
            <div>
              {athleteImage && (
                <Image
                  src={athleteImage.imageUrl}
                  alt={athleteImage.description}
                  width={600}
                  height={400}
                  className="rounded-lg object-cover aspect-[3/2]"
                  data-ai-hint={athleteImage.imageHint}
                />
              )}
            </div>
          </div>
          <div className="container mx-auto px-4 grid md:grid-cols-2 gap-16 items-center mt-16 md:mt-24">
            <div className="order-2 md:order-1">
              {scoutImage && (
                <Image
                  src={scoutImage.imageUrl}
                  alt={scoutImage.description}
                  width={600}
                  height={400}
                  className="rounded-lg object-cover aspect-[3/2]"
                  data-ai-hint={scoutImage.imageHint}
                />
              )}
            </div>
            <div className="flex flex-col items-start order-1 md:order-2">
              <div className="mb-4">
                <Search className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-3xl font-bold mb-4">For Scouts</h2>
              <p className="text-muted-foreground mb-6">Cut through the noise. Access a trusted network of athletes with structured, verifiable data to make faster, more informed talent decisions.</p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-1" />
                  <span>Reduce risk with data you can trust.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Search className="w-5 h-5 text-primary shrink-0 mt-1" />
                  <span>Discover overlooked talent with powerful search and filtering.</span>
                </li>
              </ul>
              <Button asChild>
                <Link href="/signup">Find Talent</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Philosophy and Trust Section */}
        <section className="py-16 md:py-24 bg-background">
          <div className="container mx-auto px-4 text-center max-w-3xl">
            <h2 className="text-3xl md:text-4xl font-bold">Our Philosophy: Long-Term Trust</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Talent Graph was born from a simple observation: the world of sports talent is driven by hype, not by data. As former athletes and long-time scouts, we grew frustrated with a system that values flashy highlights over proven consistency. We saw incredible talent get overlooked because they didn't fit a specific mold or have a viral video.
            </p>
            <p className="mt-4 text-lg text-muted-foreground">
              Our position is clear: we are not another social media platform for athletes. We are a professional identity layer for sports. We're building a stable, trustworthy ecosystem where discipline and consistency are the most valued assets. This isn't just a platform; it's a long-term commitment to the future of sports—one built on verifiable data and a deep respect for the athletic journey.
            </p>
             <Button size="lg" asChild className="mt-8">
                <Link href="/signup">Join The Movement</Link>
              </Button>
          </div>
        </section>

        {/* Install section */}
        <section className="py-16 md:py-20 bg-primary/5 border-t border-primary/10">
          <div className="container mx-auto px-4 text-center max-w-2xl">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
                <Download className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Install Talent Graph</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Add Talent Graph to your home screen for instant access — works on Android, iOS, and desktop. No app store needed.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <PWAInstallButton size="lg" className="min-w-[180px]" />
              <Button size="lg" variant="outline" asChild>
                <Link href="/signup">Create Free Account</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-6">
              Works on Chrome, Edge, Safari (iOS), and most Android browsers.
            </p>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
