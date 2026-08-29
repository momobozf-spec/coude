/**
 * Test environment. These are throwaway values for unit tests only — no real
 * credentials, and nothing here reaches a production code path.
 */
// @types/node declares NODE_ENV readonly; Vitest already sets it to 'test',
// this is belt-and-braces for anything that reads it during module init.
;(process.env as Record<string, string>).NODE_ENV = 'test'
process.env.APP_URL = 'http://localhost:3000'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
// 32 zero bytes, base64 — test-only key.
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
process.env.IRAIL_CONTACT_EMAIL = 'test@railclaim.test'
process.env.LOG_LEVEL = 'silent'
