"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import Button from "@/components/ui/Button";

export default function CookieBanner() {
  const t = useTranslations("cookie");
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("jj-cookie-consent");
    if (!consent) setShow(true);
  }, []);

  const accept = () => {
    localStorage.setItem("jj-cookie-consent", "accepted");
    setShow(false);
  };

  const decline = () => {
    localStorage.setItem("jj-cookie-consent", "declined");
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4"
        >
          <div className="mx-auto max-w-3xl rounded-2xl bg-white border border-border shadow-2xl p-6 flex flex-col sm:flex-row items-center gap-4">
            <p className="text-sm text-muted-foreground flex-1">{t("message")}</p>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={decline}>{t("decline")}</Button>
              <Button size="sm" onClick={accept}>{t("accept")}</Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
