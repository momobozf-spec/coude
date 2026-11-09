"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export const PREFILL_KEY = "huurklaar.check.prefill";

export function HomeSearch({ lang, placeholder, button }: { lang: string; placeholder: string; button: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  function go(e: React.FormEvent) {
    e.preventDefault();
    try { if (text.trim()) sessionStorage.setItem(PREFILL_KEY, text.slice(0, 12000)); } catch { /* geen opslag */ }
    router.push(`/${lang}/check`);
  }
  return (
    <form className="searchbar" onSubmit={go} role="search">
      <label htmlFor="home-search" className="skip">{placeholder}</label>
      <input id="home-search" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} autoComplete="off" />
      <button className="btn btn-accent" type="submit">{button}</button>
    </form>
  );
}
