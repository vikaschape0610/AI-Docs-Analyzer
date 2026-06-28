"use client";

import { motion } from "framer-motion";
import { HardDrive, Shield, Bell, Trash2, ChevronRight, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useApp, useDocuments } from "@/contexts/AppContext";

const PREFERENCES = [
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    description: "Configure notification preferences",
  },
  {
    id: "security",
    label: "Security",
    icon: Shield,
    description: "Password and account security",
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { count } = useDocuments();
  const { state: { user }, logout, clearAllDocuments } = useApp();

  // Storage values would come from the backend auth/account API
  const storageUsedMB = 0; // placeholder until backend
  const storageTotalMB = 5 * 1024; // 5 GB in MB
  const storagePercent = (storageUsedMB / storageTotalMB) * 100;

  return (
    <div className="min-h-full px-6 py-8 max-w-2xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your account and preferences
        </p>
      </motion.div>

      <div className="space-y-4">
        {/* Profile */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card border border-border/50 rounded-2xl p-5"
        >
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
              {user ? (
                <span className="text-lg font-bold text-brand">{user.avatar}</span>
              ) : (
                <User className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">
                {user ? user.name : "Your Account"}
              </p>
              <p className="text-sm text-muted-foreground">
                {user ? "Personal Account" : "Sign in to see your profile information"}
              </p>
            </div>
            {user ? (
              <button
                onClick={logout}
                className="text-xs text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-all shrink-0"
              >
                Sign Out
              </button>
            ) : (
              <button
                onClick={() => router.push("/login")}
                className="text-xs text-brand border border-brand/25 bg-brand/10 hover:bg-brand/15 px-3 py-1.5 rounded-lg transition-all shrink-0"
              >
                Sign In
              </button>
            )}
          </div>

          {/* Placeholder rows */}
          <div className="space-y-0 divide-y divide-border/40">
            {[
              { label: "Full Name", value: user ? user.name : "—" },
              { label: "Email", value: user ? user.email : "—" },
              { label: "Account Type", value: user ? user.plan : "Free Plan" },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between py-3.5 group"
              >
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                    {row.label}
                  </p>
                  <p className="text-sm text-foreground">{row.value}</p>
                </div>
                <button className="opacity-0 group-hover:opacity-100 text-xs text-brand transition-all">
                  Edit
                </button>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Storage */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border/50 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Storage</p>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {storageUsedMB > 0 ? `${storageUsedMB} MB used` : "No documents yet"}
              </span>
              <span className="text-muted-foreground">5 GB free</span>
            </div>
            <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(storagePercent, 0)}%` }}
                transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                className="h-full bg-brand rounded-full"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {count} document{count !== 1 ? "s" : ""} uploaded ·{" "}
              {storagePercent.toFixed(1)}% of storage used
            </p>
          </div>
        </motion.div>

        {/* Preferences */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card border border-border/50 rounded-2xl overflow-hidden"
        >
          {PREFERENCES.map((pref, i) => {
            const Icon = pref.icon;
            return (
              <button
                key={pref.id}
                className={cn(
                  "w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/20 transition-colors text-left group",
                  i > 0 && "border-t border-border/40"
                )}
              >
                <div className="w-8 h-8 rounded-xl bg-muted/40 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{pref.label}</p>
                  <p className="text-xs text-muted-foreground">{pref.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
              </button>
            );
          })}
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-red-500/5 border border-red-500/15 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Trash2 className="w-4 h-4 text-red-400" />
            <p className="text-sm font-semibold text-red-400">Danger Zone</p>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            These actions are permanent and cannot be undone.
          </p>
          <div className="space-y-2">
            <button
              onClick={async () => {
                if (window.confirm("Delete all documents? This cannot be undone.")) {
                  await clearAllDocuments();
                }
              }}
              className="text-xs text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 px-4 py-2 rounded-xl transition-all w-full text-left"
            >
              Delete all documents
            </button>
            <button className="text-xs text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 px-4 py-2 rounded-xl transition-all w-full text-left">
              Delete account permanently
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
