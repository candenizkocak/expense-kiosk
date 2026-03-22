"use client";

import { useState, useEffect } from "react";
import { Receipt as ReceiptIcon } from "lucide-react";

export function ReceiptImage({
  path,
  className = "",
  alt = "Receipt",
}: {
  path: string | null;
  className?: string;
  alt?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!path) return;

    fetch(`/api/receipt-image?path=${encodeURIComponent(path)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.url) setUrl(data.url);
        else setError(true);
      })
      .catch(() => setError(true));
  }, [path]);

  if (!path || error) {
    return (
      <div
        className={`bg-kiosk-bg border border-kiosk-border flex items-center justify-center ${className}`}
      >
        <ReceiptIcon className="w-6 h-6 text-kiosk-muted" />
      </div>
    );
  }

  if (!url) {
    return (
      <div
        className={`bg-kiosk-bg border border-kiosk-border flex items-center justify-center animate-pulse ${className}`}
      >
        <ReceiptIcon className="w-6 h-6 text-kiosk-muted/50" />
      </div>
    );
  }

  return <img src={url} alt={alt} className={className} />;
}
