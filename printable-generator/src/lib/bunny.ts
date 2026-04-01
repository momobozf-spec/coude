import crypto from "crypto";

const LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID!;
const API_KEY = process.env.BUNNY_STREAM_API_KEY!;
const CDN_URL = process.env.NEXT_PUBLIC_BUNNY_CDN_URL || "https://iframe.mediadelivery.net/embed";
const BASE_URL = "https://video.bunnycdn.com/library";

function headers(contentType?: string): Record<string, string> {
  const h: Record<string, string> = { AccessKey: API_KEY, accept: "application/json" };
  if (contentType) h["Content-Type"] = contentType;
  return h;
}

// ─── Create video entry (returns videoId for upload) ───────────
export async function createVideo(title: string): Promise<{ videoId: string; uploadUrl: string }> {
  const res = await fetch(`${BASE_URL}/${LIBRARY_ID}/videos`, {
    method: "POST",
    headers: headers("application/json"),
    body: JSON.stringify({ title }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bunny createVideo failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    videoId: data.guid,
    uploadUrl: `${BASE_URL}/${LIBRARY_ID}/videos/${data.guid}`,
  };
}

// ─── Upload video binary to Bunny ─────────────────────────────
export async function uploadVideo(videoId: string, fileBuffer: Buffer): Promise<void> {
  const res = await fetch(`${BASE_URL}/${LIBRARY_ID}/videos/${videoId}`, {
    method: "PUT",
    headers: { AccessKey: API_KEY, "Content-Type": "application/octet-stream" },
    body: new Uint8Array(fileBuffer),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bunny upload failed: ${res.status} ${text}`);
  }
}

// ─── Get public embed URL (unsigned — for trailers) ───────────
export function getEmbedUrl(videoId: string): string {
  return `${CDN_URL}/${LIBRARY_ID}/${videoId}`;
}

// ─── Get signed embed URL (for enrolled users) ────────────────
export function getSignedEmbedUrl(videoId: string, expiresInSeconds = 14400): string {
  // Bunny.net token authentication
  // https://docs.bunny.net/docs/stream-embedding-videos#token-authentication
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const path = `/${LIBRARY_ID}/${videoId}`;
  const tokenString = `${API_KEY}${path}${expires}`;
  const token = crypto.createHash("sha256").update(tokenString).digest("hex");

  return `${CDN_URL}${path}?token=${token}&expires=${expires}`;
}

// ─── Get video thumbnail URL ──────────────────────────────────
export function getThumbnailUrl(videoId: string): string {
  return `https://vz-${LIBRARY_ID}.b-cdn.net/${videoId}/thumbnail.jpg`;
}

// ─── Get video details / stats ────────────────────────────────
export async function getVideoStats(videoId: string): Promise<{
  title: string;
  views: number;
  watchTime: number;
  status: number;
  length: number;
  thumbnailUrl: string;
}> {
  const res = await fetch(`${BASE_URL}/${LIBRARY_ID}/videos/${videoId}`, {
    headers: headers(),
  });

  if (!res.ok) {
    throw new Error(`Bunny getVideoStats failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    title: data.title,
    views: data.views || 0,
    watchTime: data.totalWatchTime || 0,
    status: data.status, // 0=created, 1=uploaded, 2=processing, 3=transcoding, 4=finished, 5=error
    length: data.length || 0,
    thumbnailUrl: `https://vz-${LIBRARY_ID}.b-cdn.net/${videoId}/thumbnail.jpg`,
  };
}

// ─── Delete video ─────────────────────────────────────────────
export async function deleteVideo(videoId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/${LIBRARY_ID}/videos/${videoId}`, {
    method: "DELETE",
    headers: headers(),
  });

  if (!res.ok) {
    throw new Error(`Bunny deleteVideo failed: ${res.status}`);
  }
}

// ─── List all videos in library ───────────────────────────────
export async function listVideos(page = 1, perPage = 100): Promise<{
  items: { videoId: string; title: string; status: number; length: number; views: number }[];
  totalItems: number;
}> {
  const res = await fetch(
    `${BASE_URL}/${LIBRARY_ID}/videos?page=${page}&itemsPerPage=${perPage}&orderBy=date`,
    { headers: headers() }
  );

  if (!res.ok) {
    throw new Error(`Bunny listVideos failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    items: (data.items || []).map((v: Record<string, unknown>) => ({
      videoId: v.guid,
      title: v.title,
      status: v.status,
      length: v.length,
      views: v.views,
    })),
    totalItems: data.totalItems || 0,
  };
}

// ─── Check if Bunny is configured ─────────────────────────────
export function isBunnyConfigured(): boolean {
  return !!(
    LIBRARY_ID &&
    API_KEY &&
    !LIBRARY_ID.startsWith("your-") &&
    !API_KEY.startsWith("your-")
  );
}
