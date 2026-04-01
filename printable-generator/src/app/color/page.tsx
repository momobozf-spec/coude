"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/context";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ColoringCanvas from "@/components/ColoringCanvas";
import { COLORING_TEMPLATES, ColoringTemplate } from "@/lib/templates";
import Link from "next/link";

export default function ColorPage() {
  const { t } = useI18n();
  const [selected, setSelected] = useState<ColoringTemplate | null>(null);

  if (selected) {
    return (
      <div className="min-h-screen flex flex-col">
        <nav className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelected(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                &larr; {t("color.back")}
              </button>
              <span className="text-sm text-gray-300">|</span>
              <h1 className="text-lg font-bold" style={{ color: "#0d9488" }}>
                {t(selected.nameKey)}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
                {t("color.toDashboard")}
              </Link>
            </div>
          </div>
        </nav>

        <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
          <ColoringCanvas templateSvg={selected.svg} templateName={selected.id} />
        </main>
      </div>
    );
  }

  // Template picker view
  const categories = [...new Set(COLORING_TEMPLATES.map((t2) => t2.category))];

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold" style={{ color: "#0d9488" }}>
            {t("nav.brand")}
          </h1>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link href="/dashboard" className="btn-secondary text-sm">
              {t("color.toDashboard")}
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">{t("color.title")}</h2>
          <p className="text-gray-500">{t("color.subtitle")}</p>
        </div>

        {categories.map((cat) => (
          <div key={cat} className="mb-8">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
              {t(`themes.${cat}`)}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {COLORING_TEMPLATES.filter((tmpl) => tmpl.category === cat).map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => setSelected(tmpl)}
                  className="card hover:shadow-md transition-all group text-center"
                >
                  <div
                    className="w-full aspect-[4/5] mb-2 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center"
                  >
                    <div
                      className="w-full h-full"
                      dangerouslySetInnerHTML={{ __html: tmpl.svg }}
                    />
                  </div>
                  <p className="text-sm font-medium text-gray-700 group-hover:text-teal-600 transition-colors">
                    {t(tmpl.nameKey)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </main>

      <footer className="text-center py-6 text-sm text-gray-400">
        {t("footer.text")} &copy; 2026
      </footer>
    </div>
  );
}
