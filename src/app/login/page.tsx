"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setError("");
    setLoading(true);

    // Simulate auth latency
    await new Promise((r) => setTimeout(r, 1500));

    // Derive display name from email
    const localPart = email.split("@")[0];
    const name = localPart
      .replace(/[0-9]/g, "")
      .split(/[._\-]/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") || "User";

    const avatar = name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    // Persist user to localStorage so AppContext picks it up on mount
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "docmind_user",
        JSON.stringify({ name, email, avatar, plan: "Free plan" })
      );
    }

    setLoading(false);
    router.push("/workspace");
  };

  const DOC_TYPES = [
    { emoji: "🪪", label: "Aadhaar Card", color: "from-orange-500/20 to-amber-500/5" },
    { emoji: "📄", label: "Resume", color: "from-blue-500/20 to-cyan-500/5" },
    { emoji: "🎓", label: "Marksheet", color: "from-green-500/20 to-emerald-500/5" },
    { emoji: "🏦", label: "Bank Statement", color: "from-amber-500/20 to-yellow-500/5" },
    { emoji: "🛂", label: "Passport", color: "from-sky-500/20 to-blue-500/5" },
    { emoji: "📋", label: "Offer Letter", color: "from-pink-500/20 to-rose-500/5" },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left — Brand Panel */}
      <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden mesh-bg border-r border-border/50 p-12">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mb-auto">
          <div className="w-9 h-9 rounded-xl bg-brand/15 border border-brand/25 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-brand" />
          </div>
          <span className="font-semibold text-base tracking-tight">
            DocMind <span className="text-brand">AI</span>
          </span>
        </Link>

        {/* Center content */}
        <div className="flex flex-col items-start max-w-sm">
          <h2 className="text-4xl font-bold text-foreground leading-tight mb-4">
            Your personal <span className="gradient-text">document assistant</span>
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed mb-10">
            Upload any document and ask anything. DocMind AI finds the answer instantly.
          </p>

          {/* Document Cards */}
          <div className="grid grid-cols-3 gap-3 w-full">
            {DOC_TYPES.map((doc, i) => (
              <motion.div
                key={doc.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                whileHover={{ y: -4, scale: 1.04 }}
                className={`bg-gradient-to-br ${doc.color} border border-white/5 rounded-2xl p-4 text-center cursor-default`}
              >
                <div className="text-3xl mb-1.5">{doc.emoji}</div>
                <p className="text-[10px] font-medium text-muted-foreground">{doc.label}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer quote */}
        <p className="mt-auto text-xs text-muted-foreground/50 italic">
          &ldquo;Like having a personal assistant for every document you own.&rdquo;
        </p>

        {/* Background orb */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-brand/5 blur-[100px] pointer-events-none" />
      </div>

      {/* Right — Login Form */}
      <div className="flex flex-col flex-1 items-center justify-center px-6 py-12 lg:max-w-[480px]">
        {/* Mobile Logo */}
        <Link href="/" className="flex items-center gap-2 mb-10 lg:hidden">
          <div className="w-8 h-8 rounded-lg bg-brand/15 border border-brand/25 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-brand" />
          </div>
          <span className="font-semibold text-sm">DocMind <span className="text-brand">AI</span></span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-1">Welcome back</h1>
            <p className="text-muted-foreground text-sm">Sign in to your document workspace</p>
          </div>

          {/* Google Button */}
          <button className="w-full flex items-center justify-center gap-2.5 bg-card border border-border/60 hover:border-border rounded-xl px-4 py-3 text-sm font-medium text-foreground transition-all mb-6 hover:bg-card/80">
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-border/60" />
            <span className="text-xs text-muted-foreground">or continue with email</span>
            <div className="flex-1 h-px bg-border/60" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full bg-card border border-border/60 focus:border-brand/40 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Password
                </label>
                <button type="button" className="text-xs text-brand hover:text-brand/80 transition-colors">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-card border border-border/60 focus:border-brand/40 rounded-xl px-4 py-3 pr-11 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg"
              >
                {error}
              </motion.p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-brand text-white font-semibold py-3.5 rounded-xl hover:bg-brand/90 disabled:opacity-70 disabled:cursor-not-allowed transition-all glow-brand-sm text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/workspace" className="text-brand hover:text-brand/80 font-medium transition-colors">
              Get started free
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
