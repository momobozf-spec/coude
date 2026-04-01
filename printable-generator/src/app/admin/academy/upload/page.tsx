"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Course { id: string; title: string; slug: string; totalLessons: number; }

export default function AdminUploadPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState(1);
  const [isFree, setIsFree] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("admin_pwd");
    if (saved) { setPassword(saved); setAuthenticated(true); }
  }, []);

  const fetchCourses = useCallback(async () => {
    const res = await fetch("/api/academy/courses");
    const data = await res.json();
    setCourses((data.courses || []).map((c: { id: string; title: string; slug: string; totalLessons: number }) => ({
      id: c.id, title: c.title, slug: c.slug, totalLessons: c.totalLessons,
    })));
  }, []);

  useEffect(() => { if (authenticated) fetchCourses(); }, [authenticated, fetchCourses]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    sessionStorage.setItem("admin_pwd", password);
    setAuthenticated(true);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("video/")) {
      setFile(f);
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    }
  }

  async function handleUpload() {
    if (!file || !title || !selectedCourse) return;

    setUploading(true);
    setProgress(0);
    setResult(null);

    const formData = new FormData();
    formData.append("video", file);
    formData.append("title", title);
    formData.append("courseId", selectedCourse);
    formData.append("order", String(order));
    formData.append("isFree", String(isFree));
    formData.append("description", description);

    // Simulate progress (actual upload doesn't give progress via fetch)
    const progressTimer = setInterval(() => {
      setProgress(p => Math.min(p + Math.random() * 15, 90));
    }, 500);

    try {
      const res = await fetch("/api/admin/academy/upload", {
        method: "POST",
        headers: { "x-admin-password": password },
        body: formData,
      });

      clearInterval(progressTimer);

      const data = await res.json();

      if (res.ok) {
        setProgress(100);
        setResult({ success: true, message: `Uploaded "${data.lesson.title}" (Video ID: ${data.lesson.videoId})` });
        setFile(null);
        setTitle("");
        setDescription("");
        setOrder(o => o + 1);
        fetchCourses();
      } else {
        setResult({ success: false, message: data.error || "Upload failed" });
      }
    } catch (err) {
      clearInterval(progressTimer);
      setResult({ success: false, message: String(err) });
    } finally {
      setUploading(false);
    }
  }

  if (!authenticated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fdf8f0", fontFamily: "Inter, sans-serif" }}>
        <form onSubmit={handleLogin} style={{ background: "#fff", padding: 32, borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,.08)", width: 360 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "#1a6b4a" }}>&#127909; Academy Video Upload</h1>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Admin password"
            style={{ width: "100%", padding: "10px 14px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, marginBottom: 12, boxSizing: "border-box" }} />
          <button type="submit" style={{ width: "100%", padding: 12, background: "#1a6b4a", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
            Access Upload
          </button>
        </form>
      </div>
    );
  }

  const Card: React.CSSProperties = { background: "#fff", borderRadius: 12, padding: 24, border: "1px solid #e8e4dc" };

  return (
    <div style={{ minHeight: "100vh", background: "#fdf8f0", fontFamily: "Inter, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a6b4a" }}>&#127909; Upload Lesson Video</h1>
          <a href="/admin" style={{ fontSize: 13, color: "#666", textDecoration: "none" }}>&larr; Admin Dashboard</a>
        </div>

        {/* Course selector */}
        <div style={Card}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>Course</label>
          <select
            value={selectedCourse}
            onChange={e => { setSelectedCourse(e.target.value); const c = courses.find(c => c.id === e.target.value); if (c) setOrder(c.totalLessons + 1); }}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, marginBottom: 16 }}
          >
            <option value="">Select a course...</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title} ({c.totalLessons} lessons)</option>)}
          </select>

          <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>Lesson Title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Alif — The Standing Letter"
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, marginBottom: 16, boxSizing: "border-box" }} />

          <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>Description (optional)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief lesson description..."
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, marginBottom: 16, boxSizing: "border-box", minHeight: 60, resize: "vertical" }} />

          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>Order</label>
              <input type="number" value={order} onChange={e => setOrder(parseInt(e.target.value))} min={1}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "flex-end" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
                <input type="checkbox" checked={isFree} onChange={e => setIsFree(e.target.checked)} />
                Free preview lesson
              </label>
            </div>
          </div>

          {/* Drag & drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "#1a6b4a" : "#d1d5db"}`,
              borderRadius: 12,
              padding: "32px 16px",
              textAlign: "center",
              cursor: "pointer",
              backgroundColor: dragOver ? "#e8f5ec" : file ? "#f0fdf4" : "#fafafa",
              transition: "all 0.2s",
              marginBottom: 16,
            }}
          >
            <input ref={fileRef} type="file" accept="video/*" onChange={handleFileSelect} style={{ display: "none" }} />
            {file ? (
              <>
                <div style={{ fontSize: 32 }}>&#127909;</div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#333", marginTop: 8 }}>{file.name}</p>
                <p style={{ fontSize: 12, color: "#999" }}>{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </>
            ) : (
              <>
                <div style={{ fontSize: 32, opacity: 0.4 }}>&#128228;</div>
                <p style={{ fontSize: 14, color: "#666", marginTop: 8 }}>Drag & drop video here</p>
                <p style={{ fontSize: 12, color: "#999" }}>or click to browse — MP4, MOV, WebM</p>
              </>
            )}
          </div>

          {/* Progress bar */}
          {uploading && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666", marginBottom: 4 }}>
                <span>Uploading to Bunny.net...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div style={{ height: 6, backgroundColor: "#e5e7eb", borderRadius: 3 }}>
                <div style={{ height: "100%", borderRadius: 3, backgroundColor: "#1a6b4a", width: `${progress}%`, transition: "width 0.3s" }} />
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{
              padding: "12px 16px", borderRadius: 8, marginBottom: 16, fontSize: 13,
              backgroundColor: result.success ? "#e8f5ec" : "#fef2f2",
              color: result.success ? "#1a6b4a" : "#dc2626",
            }}>
              {result.success ? "✓" : "✗"} {result.message}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading || !file || !title || !selectedCourse}
            style={{
              width: "100%", padding: 14, backgroundColor: "#1a6b4a", color: "#fff",
              border: "none", borderRadius: 8, fontWeight: 600, fontSize: 15,
              cursor: uploading || !file || !title || !selectedCourse ? "not-allowed" : "pointer",
              opacity: uploading || !file || !title || !selectedCourse ? 0.5 : 1,
            }}
          >
            {uploading ? "Uploading..." : "Upload & Create Lesson"}
          </button>
        </div>
      </div>
    </div>
  );
}
