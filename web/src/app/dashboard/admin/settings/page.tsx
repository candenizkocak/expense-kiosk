"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  CheckCircle2,
  Loader2,
  Cpu,
  Zap,
  AlertCircle,
} from "lucide-react";

interface ModelOption {
  id: string;
  name: string;
  description: string;
  details: string;
  icon: React.ReactNode;
}

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "qwen",
    name: "Qwen 2.5-VL + Gemini fallback",
    description: "Open-source model on dedicated GPU, falls back to Gemini if it fails",
    details:
      "Uses Qwen2.5-VL-7B on an A10G GPU. ~5-15s per receipt (30-60s cold start). Falls back to Gemini 3.0 Flash if Qwen is unavailable.",
    icon: <Cpu className="w-5 h-5" />,
  },
  {
    id: "gemini",
    name: "Gemini 3.0 Flash",
    description: "Fast, reliable, no GPU required",
    details:
      "Sends receipts directly to Google Gemini 3.0 Flash. ~2-3s per receipt, no cold start. Requires a Gemini API key with sufficient quota.",
    icon: <Zap className="w-5 h-5" />,
  },
];

export default function AdminSettingsPage() {
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetch() {
      try {
        const res = await globalThis.fetch("/api/settings?key=ocr_model");
        const data = await res.json();
        setCurrentModel(data.value || "gemini");
      } catch {
        setCurrentModel("gemini");
      }
      setLoading(false);
    }
    fetch();
  }, []);

  async function handleSelect(modelId: string) {
    if (modelId === currentModel) return;

    setSaving(true);
    setSaved(false);
    setError("");

    try {
      const res = await globalThis.fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "ocr_model", value: modelId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }

      setCurrentModel(modelId);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message || "Failed to update setting");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-kiosk-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold">Settings</h1>
        <p className="text-kiosk-muted mt-1">System-wide configuration</p>
      </div>

      {/* OCR Model Selection */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-kiosk-accent/10 border border-kiosk-accent/20 flex items-center justify-center">
            <Settings className="w-5 h-5 text-kiosk-accent" />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold">OCR model</h2>
            <p className="text-sm text-kiosk-muted">
              Choose which model processes receipt images
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {MODEL_OPTIONS.map((option) => {
            const isSelected = currentModel === option.id;

            return (
              <button
                key={option.id}
                onClick={() => handleSelect(option.id)}
                disabled={saving}
                className={`w-full text-left p-5 rounded-xl border-2 transition-all duration-200 ${
                  isSelected
                    ? "border-kiosk-accent bg-kiosk-accent/5"
                    : "border-kiosk-border hover:border-kiosk-muted/50 bg-kiosk-bg"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? "bg-kiosk-accent/10 text-kiosk-accent"
                          : "bg-kiosk-surface text-kiosk-muted"
                      }`}
                    >
                      {option.icon}
                    </div>
                    <div>
                      <p
                        className={`font-semibold ${
                          isSelected ? "text-kiosk-accent" : ""
                        }`}
                      >
                        {option.name}
                      </p>
                      <p className="text-sm text-kiosk-muted mt-0.5">
                        {option.description}
                      </p>
                      <p className="text-xs text-kiosk-muted/70 mt-2">
                        {option.details}
                      </p>
                    </div>
                  </div>

                  <div className="flex-shrink-0 ml-4">
                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-kiosk-accent flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-kiosk-border" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Status messages */}
        {saving && (
          <div className="flex items-center gap-2 mt-4 text-sm text-kiosk-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </div>
        )}

        {saved && (
          <div className="flex items-center gap-2 mt-4 text-sm text-kiosk-accent">
            <CheckCircle2 className="w-4 h-4" />
            Model updated successfully. New receipts will use this model.
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 mt-4 text-sm text-kiosk-danger">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
