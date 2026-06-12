"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

interface DashboardNavProps {
  userName: string;
  userPlan: string;
}

export function DashboardNav({ userName, userPlan }: DashboardNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 hover:bg-emerald-50 px-3 py-2 rounded-xl transition-colors"
      >
        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-sm font-bold text-emerald-700">
          {userName?.charAt(0)?.toUpperCase() ?? "U"}
        </div>
        <span className="text-sm font-medium text-gray-700 hidden sm:block">
          {userName}
        </span>
        {userPlan === "pro" && (
          <span className="bg-gold-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
            PRO
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
            <Link
              href="/dashboard"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 transition-colors"
              onClick={() => setOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/settings"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 transition-colors"
              onClick={() => setOpen(false)}
            >
              Instellingen
            </Link>
            <hr className="my-1" />
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              Uitloggen
            </button>
          </div>
        </>
      )}
    </div>
  );
}
