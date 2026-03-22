"use client";

import { useState, useCallback, useRef } from "react";
import {
  CreditCard,
  Camera,
  CheckCircle2,
  RotateCcw,
  Send,
  Loader2,
  AlertCircle,
  Receipt,
  Upload,
} from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/types";
import type { ExpenseCategory } from "@/lib/types";

type KioskStep = "rfid" | "capture" | "processing" | "review" | "submitted";

interface OCRData {
  merchant: string;
  date: string;
  net_price: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  total_price: number | null;
  currency: string;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  raw_text: string | null;
  confidence: number;
  model_used?: string;
  category?: ExpenseCategory;
}

const KIOSK_DAEMON =
  process.env.NEXT_PUBLIC_KIOSK_DAEMON_URL || "http://localhost:8000";

export default function KioskPage() {
  const [step, setStep] = useState<KioskStep>("rfid");
  const [employeeName, setEmployeeName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [imageBase64, setImageBase64] = useState("");
  const [ocrData, setOcrData] = useState<OCRData | null>(null);
  const [editedData, setEditedData] = useState<Partial<OCRData>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Step 1: RFID Scan ───
  const handleRFIDScan = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let uid = "RFID_EMP_001"; // Default dev UID

      // Try the Pi daemon first (will fail quickly if not running)
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const rfidRes = await fetch(`${KIOSK_DAEMON}/scan-rfid`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const data = await rfidRes.json();
        uid = data.uid;
      } catch {
        // Daemon not available (dev mode) — use test UID
        console.log("Pi daemon not available, using test RFID UID:", uid);
      }

      // Look up employee via our API
      const authRes = await fetch("/api/auth/rfid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfid_uid: uid }),
      });

      if (!authRes.ok) {
        const err = await authRes.json();
        throw new Error(err.error || "RFID not recognized");
      }

      const { user } = await authRes.json();
      setEmployeeName(user.name);
      setEmployeeId(user.id);
      setStep("capture");
    } catch (e: any) {
      setError(e.message || "Failed to scan RFID");
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Step 2: Capture / Upload Receipt ───

  // Try Pi camera first, fall back to showing file picker
  const handleCapture = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const camRes = await fetch(`${KIOSK_DAEMON}/capture`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const { image_base64 } = await camRes.json();
      await processImage(image_base64);
    } catch {
      // Daemon not available — open file picker instead
      fileInputRef.current?.click();
    }
  }, []);

  // Handle file selection (dev mode fallback)
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1]; // Strip data:image/...;base64,
        await processImage(base64);
      };
      reader.readAsDataURL(file);
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    []
  );

  // Process the image (shared between camera capture and file upload)
  const processImage = useCallback(async (base64: string) => {
    setLoading(true);
    setError("");
    setImageBase64(base64);
    setStep("processing");

    try {
      const ocrRes = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64 }),
      });

      if (!ocrRes.ok) throw new Error("OCR processing failed");

      const ocrResult = await ocrRes.json();

      if (ocrResult.error) {
        throw new Error(ocrResult.error);
      }

      setOcrData(ocrResult);
      setEditedData({
        merchant: ocrResult.merchant || "",
        date: ocrResult.date || "",
        net_price: ocrResult.net_price,
        tax_rate: ocrResult.tax_rate,
        tax_amount: ocrResult.tax_amount,
        total_price: ocrResult.total_price,
        currency: ocrResult.currency || "TRY",
        category: "other" as ExpenseCategory,
      });
      setStep("review");
    } catch (e: any) {
      setError(e.message || "OCR failed");
      setStep("capture");
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Step 3: Submit for Approval ───
  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employeeId,
          image_base64: imageBase64,
          merchant: editedData.merchant,
          expense_date: editedData.date,
          net_price: editedData.net_price,
          tax_rate: editedData.tax_rate,
          tax_amount: editedData.tax_amount,
          total_price: editedData.total_price,
          currency: editedData.currency,
          category: editedData.category || "other",
          raw_ocr_json: ocrData,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit expense");
      setStep("submitted");

      // Auto-reset after 5 seconds
      setTimeout(() => resetKiosk(), 5000);
    } catch (e: any) {
      setError(e.message || "Submission failed");
    } finally {
      setLoading(false);
    }
  }, [employeeId, imageBase64, editedData, ocrData]);

  // ─── Retake ───
  const handleRetake = useCallback(() => {
    setImageBase64("");
    setOcrData(null);
    setEditedData({});
    setError("");
    setStep("capture");
  }, []);

  // ─── Full Reset ───
  const resetKiosk = useCallback(() => {
    setStep("rfid");
    setEmployeeName("");
    setEmployeeId("");
    setImageBase64("");
    setOcrData(null);
    setEditedData({});
    setError("");
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 select-none">
      {/* Hidden file input for dev mode */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Progress indicator */}
      <div className="flex items-center gap-3 mb-10">
        {(["rfid", "capture", "review", "submitted"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                step === s || (s === "review" && step === "processing")
                  ? "bg-kiosk-accent scale-125"
                  : [
                      "rfid",
                      "capture",
                      "processing",
                      "review",
                      "submitted",
                    ].indexOf(step) >
                    ["rfid", "capture", "review", "submitted"].indexOf(s)
                  ? "bg-kiosk-accent/40"
                  : "bg-kiosk-border"
              }`}
            />
            {i < 3 && (
              <div className="w-12 h-0.5 bg-kiosk-border rounded-full" />
            )}
          </div>
        ))}
      </div>

      {/* ─── RFID Scan Screen ─── */}
      {step === "rfid" && (
        <div className="text-center animate-fade-in max-w-lg">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-kiosk-accent/10 border border-kiosk-accent/20 mb-6 animate-pulse-slow">
            <CreditCard className="w-12 h-12 text-kiosk-accent" />
          </div>
          <h1 className="text-4xl font-display font-bold mb-3">
            Scan your card
          </h1>
          <p className="text-xl text-kiosk-muted mb-8">
            Hold your RFID card near the reader to begin
          </p>
          <button
            onClick={handleRFIDScan}
            className="btn-primary text-lg px-10 py-4"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                Simulate RFID scan
              </>
            )}
          </button>
          {error && (
            <div className="mt-4 text-kiosk-danger flex items-center gap-2 justify-center">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>
      )}

      {/* ─── Capture Screen ─── */}
      {step === "capture" && (
        <div className="text-center animate-fade-in max-w-lg">
          <p className="text-kiosk-accent font-medium mb-6">
            Welcome, {employeeName}
          </p>
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-kiosk-surface border border-kiosk-border mb-6">
            <Receipt className="w-12 h-12 text-kiosk-muted" />
          </div>
          <h1 className="text-4xl font-display font-bold mb-3">
            Place your receipt
          </h1>
          <p className="text-xl text-kiosk-muted mb-8">
            Place the receipt face-up on the tray, then tap capture
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleCapture}
              className="btn-primary text-lg px-10 py-4"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  Capture receipt
                </>
              )}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-ghost text-lg px-6 py-4"
              disabled={loading}
            >
              <Upload className="w-5 h-5" />
              Upload image
            </button>
          </div>
          {error && (
            <div className="mt-4 text-kiosk-danger flex items-center gap-2 justify-center">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>
      )}

      {/* ─── Processing Screen ─── */}
      {step === "processing" && (
        <div className="text-center animate-fade-in">
          <Loader2 className="w-16 h-16 text-kiosk-accent animate-spin mx-auto mb-6" />
          <h1 className="text-3xl font-display font-bold mb-3">
            Reading your receipt...
          </h1>
          <p className="text-kiosk-muted">
            Our OCR model is extracting the details
          </p>
        </div>
      )}

      {/* ─── Review Screen ─── */}
      {step === "review" && ocrData && (
        <div className="w-full max-w-4xl animate-slide-up">
          <h1 className="text-3xl font-display font-bold mb-6 text-center">
            Review expense details
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Receipt image */}
            <div className="card">
              <h2 className="text-sm font-medium text-kiosk-muted mb-3">
                Receipt image
              </h2>
              {imageBase64 && (
                <img
                  src={`data:image/jpeg;base64,${imageBase64}`}
                  alt="Receipt"
                  className="w-full rounded-xl border border-kiosk-border"
                />
              )}
              {ocrData.confidence < 0.7 && (
                <div className="mt-3 text-sm text-kiosk-warning flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Low confidence — please verify all fields
                </div>
              )}
            </div>

            {/* Editable fields */}
            <div className="card space-y-4">
              <h2 className="text-sm font-medium text-kiosk-muted mb-1">
                Extracted data
                <span className="ml-2 text-xs opacity-60">
                  via {ocrData.model_used || "OCR"}
                </span>
              </h2>

              <div>
                <label className="block text-xs text-kiosk-muted mb-1">
                  Merchant
                </label>
                <input
                  className="input-field"
                  value={editedData.merchant || ""}
                  onChange={(e) =>
                    setEditedData({ ...editedData, merchant: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-xs text-kiosk-muted mb-1">
                  Date
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={editedData.date || ""}
                  onChange={(e) =>
                    setEditedData({ ...editedData, date: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-kiosk-muted mb-1">
                    Net price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={editedData.net_price ?? ""}
                    onChange={(e) =>
                      setEditedData({
                        ...editedData,
                        net_price: parseFloat(e.target.value) || null,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-kiosk-muted mb-1">
                    Tax rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={
                      editedData.tax_rate != null
                        ? (editedData.tax_rate * 100).toFixed(2)
                        : ""
                    }
                    onChange={(e) =>
                      setEditedData({
                        ...editedData,
                        tax_rate: parseFloat(e.target.value) / 100 || null,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-kiosk-muted mb-1">
                    Tax amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={editedData.tax_amount ?? ""}
                    onChange={(e) =>
                      setEditedData({
                        ...editedData,
                        tax_amount: parseFloat(e.target.value) || null,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-kiosk-muted mb-1">
                    Total price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field font-semibold text-kiosk-accent"
                    value={editedData.total_price ?? ""}
                    onChange={(e) =>
                      setEditedData({
                        ...editedData,
                        total_price: parseFloat(e.target.value) || null,
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-kiosk-muted mb-1">
                  Currency
                </label>
                <select
                  className="input-field"
                  value={editedData.currency || "TRY"}
                  onChange={(e) =>
                    setEditedData({ ...editedData, currency: e.target.value })
                  }
                >
                  <option value="TRY">TRY (₺)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-kiosk-muted mb-1">
                  Category
                </label>
                <select
                  className="input-field"
                  value={editedData.category || "other"}
                  onChange={(e) =>
                    setEditedData({ ...editedData, category: e.target.value as ExpenseCategory })
                  }
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Line items */}
              {ocrData.line_items && ocrData.line_items.length > 0 && (
                <div>
                  <label className="block text-xs text-kiosk-muted mb-2">
                    Line items
                  </label>
                  <div className="space-y-1.5">
                    {ocrData.line_items.map((item, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-sm bg-kiosk-bg rounded-lg px-3 py-2"
                      >
                        <span className="text-kiosk-muted">
                          {item.description}
                        </span>
                        <span className="font-mono">
                          {item.total?.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button onClick={handleRetake} className="btn-ghost">
              <RotateCcw className="w-4 h-4" />
              Retake image
            </button>
            <button
              onClick={handleSubmit}
              className="btn-primary text-lg px-10"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Send for approval
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 text-center text-kiosk-danger flex items-center gap-2 justify-center">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>
      )}

      {/* ─── Submitted Screen ─── */}
      {step === "submitted" && (
        <div className="text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-kiosk-accent/10 border border-kiosk-accent/20 mb-6">
            <CheckCircle2 className="w-14 h-14 text-kiosk-accent" />
          </div>
          <h1 className="text-4xl font-display font-bold mb-3">Submitted!</h1>
          <p className="text-xl text-kiosk-muted mb-2">
            Your expense has been sent to your manager
          </p>
          <p className="text-kiosk-muted">
            Don&apos;t forget to drop the receipt into the collection slot.
          </p>
          <p className="text-sm text-kiosk-muted mt-6">
            Returning to home screen in 5 seconds...
          </p>
        </div>
      )}
    </div>
  );
}
