import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { env } from "@/lib/deployment-config";
import { hasSupabaseConfig, supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const redirectTo = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("redirectTo") || "/dashboard";
  }, []);

  useEffect(() => {
    const checkExistingSession = async () => {
      if (!hasSupabaseConfig) {
        setError(
          "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
        );
        setIsCheckingSession(false);
        return;
      }

      try {
        await base44.auth.me();
        window.location.assign(redirectTo);
        return;
      } catch (sessionError) {
        // User is not signed in yet.
      }

      setIsCheckingSession(false);
    };

    checkExistingSession();
  }, [redirectTo]);

  const handlePasswordLogin = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        throw loginError;
      }

      window.location.assign(redirectTo);
    } catch (loginError) {
      setError(loginError.message || "Unable to sign in.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      setError("Enter your email to request a magic link.");
      return;
    }

    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      const { error: magicLinkError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (magicLinkError) {
        throw magicLinkError;
      }

      setMessage("Magic link sent. Check your inbox to continue.");
    } catch (magicLinkError) {
      setError(magicLinkError.message || "Unable to send magic link.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProviderLogin = async () => {
    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      await base44.auth.redirectToLogin(redirectTo);
    } catch (providerError) {
      setError(providerError.message || "Unable to start provider login.");
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-800 text-white">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Your password"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <Button
            type="button"
            variant="outline"
            onClick={handleMagicLink}
            disabled={isLoading}
            className="w-full"
          >
            Send magic link
          </Button>

          {env.supabaseAuthProvider && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleProviderLogin}
              disabled={isLoading}
              className="w-full"
            >
              Continue with {env.supabaseAuthProvider}
            </Button>
          )}

          {error && (
            <p className="text-sm text-red-300 bg-red-950/50 border border-red-800 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          {message && (
            <p className="text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-800 rounded-md px-3 py-2">
              {message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

