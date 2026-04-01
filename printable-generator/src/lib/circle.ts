import crypto from "crypto";

const CIRCLE_API = "https://app.circle.so/api/v1";
const COMMUNITY_ID = process.env.CIRCLE_COMMUNITY_ID || "";
const API_KEY = process.env.CIRCLE_API_KEY || "";
const SSO_SECRET = process.env.CIRCLE_SSO_SECRET || "";
const SUBDOMAIN = process.env.CIRCLE_SUBDOMAIN || "noor-families";

function headers(): Record<string, string> {
  return { Authorization: `Token ${API_KEY}`, "Content-Type": "application/json" };
}

function isConfigured(): boolean {
  return !!(API_KEY && COMMUNITY_ID && !API_KEY.startsWith("your_"));
}

// Space IDs from env
function getSpaceIds() {
  return {
    welcome: process.env.CIRCLE_SPACE_WELCOME || "",
    worksheets: process.env.CIRCLE_SPACE_WORKSHEETS || "",
    ramadan: process.env.CIRCLE_SPACE_RAMADAN || "",
    qa: process.env.CIRCLE_SPACE_QA || "",
    teachers: process.env.CIRCLE_SPACE_TEACHERS || "",
    requests: process.env.CIRCLE_SPACE_REQUESTS || "",
    celebrations: process.env.CIRCLE_SPACE_CELEBRATIONS || "",
  };
}

function getSpacesForPlan(plan: string): string[] {
  const s = getSpaceIds();
  if (plan === "pro") {
    return [s.welcome, s.worksheets, s.ramadan, s.qa, s.requests, s.celebrations].filter(Boolean);
  }
  if (plan === "school") {
    return Object.values(s).filter(Boolean); // All spaces
  }
  return [];
}

// ── MEMBER MANAGEMENT ──

export async function addCommunityMember(user: {
  email: string;
  name: string;
  userId: string;
  plan: string;
}) {
  if (!isConfigured()) {
    console.log(`[Circle Mock] Add member: ${user.email} (${user.plan})`);
    return { mock: true };
  }

  const res = await fetch(`${CIRCLE_API}/community_members`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      community_id: COMMUNITY_ID,
      email: user.email,
      name: user.name,
      skip_invitation: true,
      public_uid: user.userId,
    }),
  });

  const data = await res.json();

  // Add to plan-appropriate spaces
  const spaces = getSpacesForPlan(user.plan);
  for (const spaceId of spaces) {
    await addMemberToSpace(user.email, spaceId).catch(() => {});
  }

  console.log(`[Circle] Added ${user.email} to community (${user.plan}, ${spaces.length} spaces)`);
  return data;
}

export async function removeCommunityMember(email: string) {
  if (!isConfigured()) {
    console.log(`[Circle Mock] Remove member: ${email}`);
    return { mock: true };
  }

  const res = await fetch(`${CIRCLE_API}/community_members/archive_by_email`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({ community_id: COMMUNITY_ID, email }),
  });

  console.log(`[Circle] Removed ${email} from community`);
  return res.json();
}

export async function updateMemberSpaces(email: string, newPlan: string) {
  if (!isConfigured()) {
    console.log(`[Circle Mock] Update spaces for ${email} → ${newPlan}`);
    return;
  }

  // Remove from all, then re-add to correct spaces
  const member = await getMemberByEmail(email);
  if (!member) return;

  // Get current space memberships and remove
  // (simplified — in production, track space memberships)
  const spaces = getSpacesForPlan(newPlan);
  for (const spaceId of spaces) {
    await addMemberToSpace(email, spaceId).catch(() => {});
  }

  console.log(`[Circle] Updated ${email} spaces for plan ${newPlan}`);
}

async function addMemberToSpace(email: string, spaceId: string) {
  return fetch(`${CIRCLE_API}/space_members`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ community_id: COMMUNITY_ID, space_id: spaceId, email }),
  });
}

export async function getMemberByEmail(email: string) {
  if (!isConfigured()) return null;

  const res = await fetch(
    `${CIRCLE_API}/community_members?email=${encodeURIComponent(email)}&community_id=${COMMUNITY_ID}`,
    { headers: headers() }
  );
  const data = await res.json();
  return Array.isArray(data) ? data[0] || null : null;
}

// ── SSO ──

export function generateSSOToken(user: {
  email: string;
  name: string;
  userId: string;
  avatarUrl?: string;
}): string {
  const payload = {
    email: user.email,
    name: user.name,
    external_id: user.userId,
    avatar_url: user.avatarUrl || "",
  };

  const token = Buffer.from(JSON.stringify(payload)).toString("base64");
  const signature = crypto
    .createHmac("sha256", SSO_SECRET)
    .update(token)
    .digest("hex");

  return `${token}.${signature}`;
}

export function generateSSOUrl(
  user: Parameters<typeof generateSSOToken>[0],
  redirectPath?: string
): string {
  if (!SSO_SECRET) {
    return `https://${SUBDOMAIN}.circle.so`;
  }

  const token = generateSSOToken(user);
  const redirect = redirectPath
    ? `&destination_url=${encodeURIComponent(redirectPath)}`
    : "";

  return `https://${SUBDOMAIN}.circle.so/sso?jwt_token=${token}${redirect}`;
}

// ── STATS ──

export async function getCommunityStats(): Promise<{
  totalMembers: number;
  totalPosts: number;
  upcomingEvents: number;
}> {
  if (!isConfigured()) {
    return { totalMembers: 847, totalPosts: 234, upcomingEvents: 2 }; // Demo data
  }

  try {
    const [membersRes, postsRes] = await Promise.all([
      fetch(`${CIRCLE_API}/community_members?community_id=${COMMUNITY_ID}&per_page=1`, { headers: headers() }),
      fetch(`${CIRCLE_API}/posts?community_id=${COMMUNITY_ID}&per_page=1`, { headers: headers() }),
    ]);

    const membersData = await membersRes.json();
    const postsData = await postsRes.json();

    return {
      totalMembers: membersData?.meta?.total_count || 0,
      totalPosts: postsData?.meta?.total_count || 0,
      upcomingEvents: 0,
    };
  } catch {
    return { totalMembers: 0, totalPosts: 0, upcomingEvents: 0 };
  }
}

// ── EVENTS ──

export async function createWeeklyQA(event: {
  title: string;
  description: string;
  startsAt: Date;
  durationMinutes: number;
  zoomUrl?: string;
}) {
  if (!isConfigured()) {
    console.log(`[Circle Mock] Create event: ${event.title}`);
    return { mock: true, title: event.title };
  }

  const res = await fetch(`${CIRCLE_API}/events`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      community_id: COMMUNITY_ID,
      space_id: getSpaceIds().qa,
      name: event.title,
      description: event.description,
      starts_at: event.startsAt.toISOString(),
      duration: event.durationMinutes,
      location: event.zoomUrl || "Online — link posted in community",
      event_type: "virtual",
    }),
  });

  return res.json();
}

// ── RECENT POSTS ──

export async function getRecentPosts(limit = 3): Promise<
  { authorName: string; preview: string; spaceId: string }[]
> {
  if (!isConfigured()) {
    return [
      { authorName: "Fatima A.", preview: "My daughter loved this week's mosque coloring page!", spaceId: "" },
      { authorName: "Ahmed K.", preview: "Weekly Ramadan theme: What should we color this week?", spaceId: "" },
      { authorName: "Sara M.", preview: "Masha'Allah! Look at my son's completed Arabic letters...", spaceId: "" },
    ];
  }

  try {
    const res = await fetch(
      `${CIRCLE_API}/posts?community_id=${COMMUNITY_ID}&per_page=${limit}&sort=latest`,
      { headers: headers() }
    );
    const posts = await res.json();

    return (Array.isArray(posts) ? posts : []).map((p: Record<string, unknown>) => ({
      authorName: (p.user as Record<string, string>)?.name || "Member",
      preview: ((p.body as Record<string, string>)?.plain_text || "").slice(0, 80),
      spaceId: (p.space_id as string) || "",
    }));
  } catch {
    return [];
  }
}

export { isConfigured as isCircleConfigured };
