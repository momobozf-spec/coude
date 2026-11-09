"use client";

import { useState, FormEvent } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    count?: number;
  } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setResult({
          success: true,
          message: data.message ?? "Import geslaagd",
          count: data.count,
        });
        setFile(null);
      } else {
        setResult({
          success: false,
          message: data.error ?? "Er is iets misgegaan bij de import",
        });
      }
    } catch {
      setResult({
        success: false,
        message: "Er is iets misgegaan bij de import",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight font-[family-name:var(--font-heading)]">
        Producten importeren
      </h1>
      <p className="mt-2 text-muted-foreground">
        Importeer producten vanuit een CSV-bestand (Spocket/Turkopt formaat)
      </p>

      <div className="mt-8 max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File drop area */}
          <label
            htmlFor="csv-upload"
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-white p-12 text-center cursor-pointer hover:border-emerald/50 hover:bg-emerald/5 transition-colors"
          >
            <div className="rounded-full bg-emerald/10 p-3 mb-4">
              <FileSpreadsheet className="h-8 w-8 text-emerald" />
            </div>
            {file ? (
              <>
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">
                  Klik om een CSV-bestand te selecteren
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ondersteunde formaten: .csv
                </p>
              </>
            )}
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {/* CSV format info */}
          <div className="rounded-2xl border border-border bg-white p-6">
            <h3 className="text-sm font-semibold mb-3">Verwacht CSV-formaat</h3>
            <div className="overflow-x-auto">
              <code className="block text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 whitespace-nowrap">
                name,description,price,comparePrice,images,sizes,colors,stock,category,badge
              </code>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              <li>
                <strong>images:</strong> gescheiden door puntkomma (;)
              </li>
              <li>
                <strong>sizes/colors:</strong> gescheiden door puntkomma (;)
              </li>
              <li>
                <strong>category:</strong> exacte naam van bestaande categorie
              </li>
              <li>
                <strong>badge:</strong> NEW, BESTSELLER of leeg
              </li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={!file || loading}
            className="inline-flex items-center gap-2 rounded-full bg-emerald text-white px-8 h-11 text-sm font-medium hover:bg-emerald/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            {loading ? "Importeren..." : "Importeren"}
          </button>
        </form>

        {/* Result message */}
        {result && (
          <div
            className={`mt-6 rounded-2xl border p-4 flex items-start gap-3 ${
              result.success
                ? "border-green-200 bg-green-50"
                : "border-destructive/20 bg-destructive/5"
            }`}
          >
            {result.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            )}
            <div>
              <p
                className={`text-sm font-medium ${
                  result.success ? "text-green-800" : "text-destructive"
                }`}
              >
                {result.message}
              </p>
              {result.count !== undefined && (
                <p className="text-xs text-green-700 mt-1">
                  {result.count} product{result.count !== 1 && "en"} geimporteerd
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
