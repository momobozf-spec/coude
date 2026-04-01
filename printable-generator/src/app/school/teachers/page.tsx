"use client";

import { useState, useEffect, useCallback } from "react";

interface Teacher { id: string; name: string; email: string; whiteLabelRole: string | null; generationsCount: number; updatedAt: string; }
interface Invite { id: string; email: string; role: string; accepted: boolean; createdAt: string; }

export default function SchoolTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [maxSeats, setMaxSeats] = useState(10);
  const [newEmails, setNewEmails] = useState("");
  const [inviting, setInviting] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/white-label/invite");
    if (res.ok) {
      const data = await res.json();
      setTeachers(data.teachers || []);
      setInvites(data.invites || []);
      setMaxSeats(data.maxSeats || 10);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleInvite() {
    setInviting(true);
    const emails = newEmails.split("\n").map(e => e.trim()).filter(Boolean);
    await fetch("/api/white-label/invite", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails, role: "teacher" }),
    });
    setNewEmails("");
    await fetchData();
    setInviting(false);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;

  const usedSeats = teachers.length;
  const pendingInvites = invites.filter(i => !i.accepted);

  return (
    <div className="min-h-screen" style={{ background: "#faf9f5" }}>
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <span className="font-bold" style={{ color: "#1a6b4a" }}>Teacher Management</span>
          <a href="/school/branding" className="text-sm text-gray-500">Branding</a>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card text-center">
            <p className="text-xs text-gray-400">Active Teachers</p>
            <p className="text-2xl font-bold">{usedSeats}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-400">Pending Invites</p>
            <p className="text-2xl font-bold" style={{ color: "#c9920a" }}>{pendingInvites.length}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-400">Seats Available</p>
            <p className="text-2xl font-bold" style={{ color: "#1a6b4a" }}>{maxSeats - usedSeats}</p>
          </div>
        </div>

        {/* Invite */}
        <div className="card mb-6">
          <h3 className="font-bold mb-3">Invite Teachers</h3>
          <textarea className="input-field mb-3" style={{ minHeight: 80 }} placeholder={"teacher1@school.com\nteacher2@school.com"} value={newEmails} onChange={e => setNewEmails(e.target.value)} />
          <button onClick={handleInvite} disabled={inviting || !newEmails.trim()} className="btn-primary" style={{ backgroundColor: "#1a6b4a" }}>
            {inviting ? "Sending..." : "Send Invitations"}
          </button>
        </div>

        {/* Teachers table */}
        <div className="card overflow-x-auto">
          <h3 className="font-bold mb-3">Teachers ({usedSeats})</h3>
          {teachers.length === 0 ? (
            <p className="text-gray-400 text-sm">No teachers yet. Invite them above!</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e8e4dc" }}>
                  <th style={{ textAlign: "left", padding: "8px 4px" }}>Name</th>
                  <th style={{ textAlign: "left", padding: "8px 4px" }}>Email</th>
                  <th style={{ textAlign: "center", padding: "8px 4px" }}>Role</th>
                  <th style={{ textAlign: "right", padding: "8px 4px" }}>Sheets</th>
                  <th style={{ textAlign: "right", padding: "8px 4px" }}>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map(t => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "8px 4px" }}>{t.name}</td>
                    <td style={{ padding: "8px 4px", color: "#666" }}>{t.email}</td>
                    <td style={{ padding: "8px 4px", textAlign: "center" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, backgroundColor: t.whiteLabelRole === "admin" ? "#e8f5ec" : "#f3f4f6", color: t.whiteLabelRole === "admin" ? "#1a6b4a" : "#666" }}>
                        {(t.whiteLabelRole || "teacher").toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "8px 4px", textAlign: "right" }}>{t.generationsCount}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", color: "#999" }}>{new Date(t.updatedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <div className="card mt-4">
            <h3 className="font-bold mb-3 text-sm">Pending Invitations</h3>
            {pendingInvites.map(inv => (
              <div key={inv.id} className="flex justify-between items-center py-2 border-b border-gray-100 text-sm">
                <span className="text-gray-600">{inv.email}</span>
                <span className="text-xs text-gray-400">Sent {new Date(inv.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
