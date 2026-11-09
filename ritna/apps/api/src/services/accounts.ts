import { hashPassword, verifyPassword, type AuthUser, type Role } from '../auth.js';
import type { Ctx } from '../context.js';
import { maybeOne, one, type Queryable } from '../db.js';
import { AppError, conflict } from '../errors.js';

export interface UserRow {
  id: string;
  role: Role;
  email: string;
  phone: string | null;
  full_name: string;
  password_hash: string;
  locale: 'nl' | 'fr' | 'en';
  is_active: boolean;
}

export async function createUser(
  q: Queryable,
  input: { role: Role; email: string; password: string; fullName: string; phone?: string; locale?: 'nl' | 'fr' | 'en' },
): Promise<UserRow> {
  const email = input.email.trim().toLowerCase();
  const exists = await maybeOne(q, 'select 1 from users where email = $1', [email]);
  if (exists) throw conflict('email_taken', 'E-mailadres is al in gebruik');
  return one<UserRow>(
    q,
    `insert into users (role, email, phone, full_name, password_hash, locale) values ($1,$2,$3,$4,$5,$6) returning *`,
    [input.role, email, input.phone ?? null, input.fullName, await hashPassword(input.password), input.locale ?? 'nl'],
  );
}

/** Bouwt de JWT-inhoud, inclusief vervoerder/chauffeur-koppeling. */
export async function tokenPayload(q: Queryable, user: UserRow): Promise<AuthUser> {
  if (user.role === 'operator_admin') {
    const ou = await maybeOne<{ operator_id: string }>(q, 'select operator_id from operator_users where user_id = $1', [user.id]);
    return { sub: user.id, role: user.role, operatorId: ou?.operator_id };
  }
  if (user.role === 'driver') {
    const d = await maybeOne<{ id: string; operator_id: string }>(q, 'select id, operator_id from drivers where user_id = $1', [user.id]);
    return { sub: user.id, role: user.role, driverId: d?.id, operatorId: d?.operator_id };
  }
  return { sub: user.id, role: user.role };
}

export async function login(ctx: Ctx, email: string, password: string): Promise<{ user: UserRow; payload: AuthUser }> {
  const user = await maybeOne<UserRow>(ctx.db, 'select * from users where email = $1', [email.trim().toLowerCase()]);
  const invalid = new AppError(401, 'invalid_credentials', 'Onjuist e-mailadres of wachtwoord');
  if (!user || !user.is_active) throw invalid;
  if (!(await verifyPassword(password, user.password_hash))) throw invalid;
  return { user, payload: await tokenPayload(ctx.db, user) };
}

export function publicUser(u: UserRow) {
  return { id: u.id, role: u.role, email: u.email, phone: u.phone, fullName: u.full_name, locale: u.locale };
}
