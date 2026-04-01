# Circle.so Setup Guide — Noor Families Community

## Step 1: Create Circle.so Account
1. Go to [circle.so](https://circle.so) → Start Free Trial
2. Community name: **Noor Families**
3. Subdomain: `noor-families.circle.so`
4. Plan: **Professional ($89/month)** — needed for SSO + API

## Step 2: Create Spaces
Create these spaces in your Circle community:

| Space | Emoji | Access | Description |
|-------|-------|--------|-------------|
| Welcome & Introductions | 🌟 | All members | New member intros + community guidelines |
| Worksheet Share | 🎨 | Pro + School | Share colored worksheets + photos |
| Ramadan Corner | 🌙 | All members | Ramadan tips, duas, activities (seasonal) |
| Islamic Parenting Q&A | 📚 | Pro + School | Weekly live Q&A with Islamic educator |
| Teachers Lounge | 🏫 | School only | Exclusive space for school plan members |
| Feature Requests | 💡 | Pro + School | Suggest + vote on new worksheet themes |
| Wins & Celebrations | 🎉 | Pro + School | Kids' progress photos + certificate celebrations |

## Step 3: Get API Credentials
1. Settings → API → Generate API Key → copy `CIRCLE_API_KEY`
2. Settings → SSO → Enable SSO → copy `CIRCLE_SSO_SECRET`
3. Note your Community ID from the URL: `CIRCLE_COMMUNITY_ID`
4. Copy each Space ID from the space settings page

## Step 4: Environment Variables
Add to `.env.local`:
```
CIRCLE_API_KEY=your_circle_api_key
CIRCLE_COMMUNITY_ID=your_community_id
CIRCLE_SSO_SECRET=your_sso_secret_key
CIRCLE_SUBDOMAIN=noor-families
NEXT_PUBLIC_CIRCLE_URL=https://noor-families.circle.so

CIRCLE_SPACE_WELCOME=space_id
CIRCLE_SPACE_WORKSHEETS=space_id
CIRCLE_SPACE_RAMADAN=space_id
CIRCLE_SPACE_QA=space_id
CIRCLE_SPACE_TEACHERS=space_id
CIRCLE_SPACE_REQUESTS=space_id
CIRCLE_SPACE_CELEBRATIONS=space_id
```

## Step 5: Branding
In Circle settings:
- Upload Noor Printables logo
- Primary color: `#1a6b4a`
- Accent color: `#c9920a`
- Cover image: Islamic geometric pattern
- Customize the welcome email with Noor branding

## Step 6: Test
1. Create a test user with Pro plan in Noor Printables
2. Click "Enter Community" in dashboard
3. User should be auto-logged in to Circle via SSO
4. Verify they can see the correct spaces for their plan

## Automation
- New Pro/School subscriber → auto-added to community (via Stripe webhook)
- Plan change → spaces updated automatically
- Cancellation → removed from community automatically
- No manual work needed!
