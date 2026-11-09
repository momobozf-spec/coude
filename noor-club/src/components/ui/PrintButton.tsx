"use client";

import { Button } from "@/components/ui/Button";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="secondary" onClick={() => window.print()} className="no-print">
      🖨️ {label}
    </Button>
  );
}
