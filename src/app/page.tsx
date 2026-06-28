"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  Upload,
  Search,
  Brain,
  Shield,
  Zap,
  ChevronDown,
} from "lucide-react";

const DEMO_QUESTIONS = [
  "Summarize my resume",
  "Find my Semester 5 marksheet",
  "Show all uploaded certificates",
  "List documents containing my address",
  "What documents have I uploaded?",
];

const FEATURES = [
  {
    icon: Brain,
    title: "AI-Powered Understanding",
    description: "Ask natural language questions. DocMind reads and understands every document you upload.",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
  },
  {
    icon: Search,
    title: "Instant Smart Search",
    description: "Find specific information across all your documents in milliseconds using semantic search.",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: Zap,
    title: "Auto-Extraction",
    description: "Key details like names, dates, IDs, and numbers are automatically extracted from every file.",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: Shield,
    title: "Private & Secure",
    description: "Your documents stay private. All processing happens securely with enterprise-grade encryption.",
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
  },
];

const DOC_TYPES = [
  { emoji: "🪪", label: "Aadhaar Card", color: "from-orange-500/20 to-amber-500/10" },
  { emoji: "📄", label: "Resume", color: "from-blue-500/20 to-cyan-500/10" },
  { emoji: "🎓", label: "Marksheet", color: "from-green-500/20 to-emerald-500/10" },
  { emoji: "🏦", label: "Bank Statement", color: "from-amber-500/20 to-yellow-500/10" },
  { emoji: "🛂", label: "Passport", color: "from-sky-500/20 to-blue-500/10" },
  { emoji: "📋", label: "Offer Letter", color: "from-pink-500/20 to-rose-500/10" },
];

export default function LandingPage() {
  const [questionIdx, setQuestionIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [typed, setTyped] = useState("");

  // Cycle questions
  useEffect(() => {
    const cycle = () => {
      setShowAnswer(false);
      setTyped("");
      const q = DEMO_QUESTIONS[questionIdx];
      let i = 0;
      const typeInterval = setInterval(() => {
        setTyped(q.slice(0, i + 1));
        i++;
        if (i >= q.length) {
          clearInterval(typeInterval);
          setTimeout(() => setShowAnswer(true), 400);
        }
      }, 35);
      return typeInterval;
    };

    const t = cycle();
    const rotateTimer = setInterval(() => {
      setQuestionIdx((prev) => (prev + 1) % DEMO_QUESTIONS.length);
    }, 4500);

    return () => {
      clearInterval(t);
      clearInterval(rotateTimer);
    };
  }, [questionIdx]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border/30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand/15 border border-brand/25 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-brand" />
            </div>
            <span className="font-semibold text-sm tracking-tight">
              DocMind <span className="text-brand">AI</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-1.5 text-sm font-medium bg-brand text-white px-4 py-2 rounded-xl hover:bg-brand/90 transition-all glow-brand-sm"
            >
              Get Started <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-20 pb-16 mesh-bg overflow-hidden">
        {/* Background orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-brand/5 blur-[120px]" />
          <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full bg-violet-500/5 blur-[80px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 text-xs font-medium text-brand bg-brand/10 border border-brand/20 px-3 py-1.5 rounded-full mb-6"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Document Intelligence
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]"
          >
            Ask Anything About{" "}
            <span className="gradient-text">Your Documents.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Upload your PDFs, images, and files. Ask questions in plain English.
            Get instant answers powered by AI — like having a personal assistant for every document you own.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16"
          >
            <Link
              href="/workspace"
              className="flex items-center gap-2 bg-brand text-white font-semibold px-6 py-3.5 rounded-2xl hover:bg-brand/90 transition-all glow-brand shadow-lg text-sm"
            >
              <Sparkles className="w-4 h-4" />
              Try DocMind AI Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/workspace/documents"
              className="flex items-center gap-2 text-sm text-muted-foreground border border-border/60 hover:border-border bg-card/50 px-6 py-3.5 rounded-2xl transition-all hover:text-foreground"
            >
              <Upload className="w-4 h-4" />
              Upload a document
            </Link>
          </motion.div>

          {/* Demo Card */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 25 }}
            className="max-w-xl mx-auto"
          >
            <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-2xl shadow-brand/5 text-left">
              {/* Question Bar */}
              <div className="flex items-center gap-3 bg-surface border border-border/60 rounded-2xl px-4 py-3 mb-4">
                <Sparkles className="w-4 h-4 text-brand shrink-0" />
                <span className="text-sm text-foreground flex-1 min-h-[20px]">
                  {typed}
                  <span className="inline-block w-0.5 h-4 bg-brand ml-0.5 animate-pulse" />
                </span>
              </div>

              {/* Answer */}
              <AnimatePresence>
                {showAnswer && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-brand/15 border border-brand/25 flex items-center justify-center shrink-0">
                        <Sparkles className="w-3.5 h-3.5 text-brand" />
                      </div>
                      <div className="bg-surface rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-foreground">
                        I found relevant information in your uploaded documents.
                        Upload documents and ask questions to receive AI-powered answers with source citations.
                      </div>
                    </div>
                    <div className="ml-10">
                      <p className="text-xs text-muted-foreground">
                        Sources will appear here when documents are uploaded.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Scroll hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="mt-12 flex justify-center"
          >
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-muted-foreground/40"
            >
              <ChevronDown className="w-5 h-5" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Document Types */}
      <section className="py-20 px-6 border-t border-border/30">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
              Supports All Document Types
            </p>
            <h2 className="text-3xl font-bold text-foreground">
              Every document you own, <span className="gradient-text">understood.</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {DOC_TYPES.map((doc, i) => (
              <motion.div
                key={doc.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                whileHover={{ y: -4, scale: 1.03 }}
                className={`bg-gradient-to-br ${doc.color} border border-white/5 rounded-2xl p-4 text-center`}
              >
                <div className="text-3xl mb-2">{doc.emoji}</div>
                <p className="text-xs font-medium text-muted-foreground">{doc.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-surface/30 border-t border-border/30">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
              How It Works
            </p>
            <h2 className="text-3xl font-bold">Three steps to document intelligence</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Upload", desc: "Drop any PDF, image, or document. DocMind accepts all formats.", emoji: "📤" },
              { step: "02", title: "AI Processes", desc: "Text extraction, OCR, categorization, summarization, and embedding — all automatic.", emoji: "🤖" },
              { step: "03", title: "Ask & Get Answers", desc: "Ask anything in plain language. Get instant, cited answers from your documents.", emoji: "💬" },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="text-center"
              >
                <div className="w-16 h-16 rounded-3xl bg-brand/10 border border-brand/20 flex items-center justify-center text-3xl mx-auto mb-4">
                  {item.emoji}
                </div>
                <div className="text-[10px] font-bold text-brand/60 tracking-widest mb-2">{item.step}</div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 border-t border-border/30">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl font-bold mb-3">Built for serious document work</h2>
            <p className="text-muted-foreground text-base">Everything you need to unlock the information in your files.</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -3 }}
                  className="bg-card border border-border/50 rounded-2xl p-6 hover:border-brand/25 transition-all duration-200"
                >
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${f.bg}`}>
                    <Icon className={`w-5 h-5 ${f.color}`} />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-border/30 mesh-bg">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold mb-4">
              Your documents are waiting to <span className="gradient-text">talk to you.</span>
            </h2>
            <p className="text-muted-foreground mb-8">
              Join thousands of users who use DocMind AI to find information in seconds.
            </p>
            <Link
              href="/workspace"
              className="inline-flex items-center gap-2 bg-brand text-white font-semibold px-8 py-4 rounded-2xl hover:bg-brand/90 transition-all glow-brand shadow-lg text-base"
            >
              <Sparkles className="w-5 h-5" />
              Start for Free
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-brand" />
            <span>DocMind AI · 2026</span>
          </div>
          <p>AI-powered Document Intelligence Platform</p>
        </div>
      </footer>
    </div>
  );
}
