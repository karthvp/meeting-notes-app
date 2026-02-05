'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const features = [
  { title: 'Auto-classify meetings', description: 'AI automatically categorizes your meeting notes' },
  { title: 'Smart team sharing', description: 'Share with the right team members instantly' },
  { title: 'Track action items', description: 'Never miss a decision or follow-up' },
  { title: 'Drive integration', description: 'Works with your existing Google Drive' },
];

export default function LoginPage() {
  const { user, loading, signIn, error } = useAuth();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signIn();
    } catch (err) {
      console.error('Sign in error:', err);
    } finally {
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'linear-gradient(145deg, #001433 0%, #002259 40%, #062F73 70%, #0844A6 100%)' }}>
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: 'linear-gradient(145deg, #001433 0%, #002259 40%, #062F73 70%, #0844A6 100%)' }}>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-[#0D6AFF]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 bg-[#0DFFAE]/5 rounded-full blur-3xl" />
      </div>

      <Card className="relative w-full max-w-md border-0 shadow-2xl bg-white backdrop-blur-sm">
        <CardHeader className="space-y-1 text-center pb-2">
          {/* Egen Notes Logo - same as dashboard sidebar */}
          <div className="flex justify-center mb-4">
            <Image
              src="/egen-notes-logo.png"
              alt="Egen Notes"
              width={220}
              height={55}
              className="object-contain"
              priority
            />
          </div>
          <CardDescription className="text-[#4D6080]">
            Accelerate time to value with intelligent meeting insights
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          {/* Features list */}
          <div className="space-y-3 py-2">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0D6AFF]/10 flex items-center justify-center mt-0.5">
                  <Check className="w-3 h-3 text-[#0D6AFF]" />
                </div>
                <div>
                  <span className="text-sm font-medium text-[#001433]">{feature.title}</span>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <Button
            className="group w-full h-12 bg-[#0D6AFF] hover:bg-[#0049BF] text-white font-medium text-base egen-transition egen-primary-glow"
            size="lg"
            onClick={handleSignIn}
            disabled={signingIn}
          >
            {signingIn ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
                <ArrowRight className="ml-2 h-4 w-4 egen-arrow" />
              </>
            )}
          </Button>

          <div className="space-y-3">
            <p className="text-center text-sm text-[#4D6080]">
              Only @egen.ai accounts are allowed
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <div className="h-px flex-1 bg-[#CEDBF2]" />
              <span className="text-xs text-[#A2ADBF] px-2">Secure enterprise login</span>
              <div className="h-px flex-1 bg-[#CEDBF2]" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer tagline */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
        <p className="text-white/60 text-sm">
          In Motion. Purposeful. Focused.
        </p>
      </div>
    </div>
  );
}
