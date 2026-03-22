"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserCircle, Lock, CheckCircle2, AlertCircle } from "lucide-react";

export default function ProfilePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<{
    name: string;
    email: string;
    role: string;
    created_at: string;
  } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check admins
      const { data: admin } = await supabase
        .from("admins")
        .select("name, email, created_at")
        .eq("auth_user_id", user.id)
        .single();
      if (admin) {
        setProfile({ ...admin, role: "Admin" });
        return;
      }

      // Check managers
      const { data: manager } = await supabase
        .from("managers")
        .select("name, email, created_at")
        .eq("auth_user_id", user.id)
        .single();
      if (manager) {
        setProfile({ ...manager, role: "Manager" });
        return;
      }

      // Check employees
      const { data: employee } = await supabase
        .from("employees")
        .select("name, email, created_at")
        .eq("auth_user_id", user.id)
        .single();
      if (employee) {
        setProfile({ ...employee, role: "Employee" });
      }
    }
    init();
  }, [supabase]);

  async function handlePasswordChange() {
    if (newPassword.length < 6) {
      setPasswordMessage({ type: "error", text: "Password must be at least 6 characters" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Passwords do not match" });
      return;
    }

    setPasswordLoading(true);
    setPasswordMessage(null);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setPasswordMessage({ type: "error", text: error.message });
    } else {
      setPasswordMessage({ type: "success", text: "Password updated successfully" });
      setNewPassword("");
      setConfirmPassword("");
    }
    setPasswordLoading(false);
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-kiosk-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-display font-bold mb-6">Profile</h1>

      {/* User info */}
      <div className="card mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-kiosk-accent/10 border border-kiosk-accent/20 flex items-center justify-center">
            <UserCircle className="w-8 h-8 text-kiosk-accent" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold">{profile.name}</h2>
            <p className="text-kiosk-muted">{profile.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-kiosk-bg rounded-xl p-4">
            <p className="text-xs text-kiosk-muted">Role</p>
            <p className="font-semibold mt-1">{profile.role}</p>
          </div>
          <div className="bg-kiosk-bg rounded-xl p-4">
            <p className="text-xs text-kiosk-muted">Member since</p>
            <p className="font-mono mt-1">
              {new Date(profile.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="card">
        <div className="flex items-center gap-3 mb-5">
          <Lock className="w-5 h-5 text-kiosk-muted" />
          <h2 className="text-lg font-display font-bold">Change password</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-kiosk-muted mb-1.5">New password</label>
            <input
              type="password"
              className="input-field"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-kiosk-muted mb-1.5">Confirm password</label>
            <input
              type="password"
              className="input-field"
              placeholder="Type it again"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {passwordMessage && (
            <div
              className={`flex items-center gap-2 text-sm px-4 py-3 rounded-xl ${
                passwordMessage.type === "success"
                  ? "bg-kiosk-accent/10 text-kiosk-accent border border-kiosk-accent/20"
                  : "bg-kiosk-danger/10 text-kiosk-danger border border-kiosk-danger/20"
              }`}
            >
              {passwordMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              {passwordMessage.text}
            </div>
          )}

          <button
            onClick={handlePasswordChange}
            className="btn-primary"
            disabled={passwordLoading || !newPassword || !confirmPassword}
          >
            {passwordLoading ? "Updating..." : "Update password"}
          </button>
        </div>
      </div>
    </div>
  );
}
