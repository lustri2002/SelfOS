"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function ExportButton() {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);

    try {
      const response = await fetch("/api/export");
      if (!response.ok) return;
      const payload = JSON.stringify(await response.json(), null, 2);

      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `selfos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleExport}
      disabled={loading}
      variant="subtle"
      leadingIcon={<Download className="h-4 w-4" />}
    >
      {loading ? "Esportazione..." : "Esporta JSON"}
    </Button>
  );
}
