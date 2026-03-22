"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogIn, Receipt, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();
  const { theme, toggle } = useTheme();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <button
        onClick={toggle}
        className="absolute top-6 right-6 p-2.5 rounded-xl bg-kiosk-surface border border-kiosk-border hover:border-kiosk-muted/50 transition-colors"
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <Sun className="w-4 h-4 text-kiosk-muted" /> : <Moon className="w-4 h-4 text-kiosk-muted" />}
      </button>
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo area */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-kiosk-accent/10 border border-kiosk-accent/20 mb-4">
            <Receipt className="w-8 h-8 text-kiosk-accent" />
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight">
            Expense Kiosk
          </h1>
          <p className="text-kiosk-muted mt-2">
            Sign in to manage expenses
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin} className="card space-y-5">
          <div>
            <label className="block text-sm font-medium text-kiosk-muted mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="you@company.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-kiosk-muted mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-kiosk-danger bg-kiosk-danger/10 border border-kiosk-danger/20 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            <LogIn className="w-4 h-4" />
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-kiosk-muted mt-6">
          Using the kiosk? Scan your RFID card instead.
        </p>
      </div>
    </div>
  );
}
