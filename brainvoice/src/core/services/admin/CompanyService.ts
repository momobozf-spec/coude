import { findBestMatch, type MatchResult } from '../../commands/matching';
import type { Database } from '../../db/Database';
import { DEFAULT_COMMUNICATION_PREFERENCES, DEFAULT_COMPANY_PROFILE, EMPTY_ADDRESS, type Address, type Audience, type CommunicationPreferences, type CommunicationStyle, type Company, type CompanyKind, type CompanyProfile, type Contact } from '../../domain/admin';
import { normalizeIban } from '../../finance/payment';
import { DomainError } from '../../types/common';
import { newId } from '../../util/id';
import type { Clock } from '../Clock';

const PROFILE_KEY = 'admin.companyProfile';
const STYLE_KEY = 'admin.communicationStyles';

export interface CompanyInput {
  name: string;
  legalName?: string | null;
  kind?: CompanyKind;
  vatNumber?: string | null;
  companyNumber?: string | null;
  address?: Partial<Address> | null;
  email?: string | null;
  phone?: string | null;
  paymentTermsDays?: number | null;
  defaultTaxRate?: number | null;
  iban?: string | null;
  notes?: string | null;
}

export interface ContactInput {
  name: string;
  companyId?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  audience?: Audience | null;
  stylePreference?: CommunicationStyle | null;
  notes?: string | null;
}

/**
 * Companies (clients & suppliers), contacts, the user's own business profile (§105–§106)
 * and explicit communication-style preferences (§97).
 */
export class CompanyService {
  private profileCache: CompanyProfile | null = null;
  private styleCache: CommunicationPreferences | null = null;

  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  // ---------------------------------------------------------------------------
  // Business profile
  // ---------------------------------------------------------------------------

  async profile(): Promise<CompanyProfile> {
    if (this.profileCache) return this.profileCache;
    const raw = await this.db.settings.get(PROFILE_KEY);
    let stored: Partial<CompanyProfile> = {};
    if (raw) {
      try {
        stored = JSON.parse(raw) as Partial<CompanyProfile>;
      } catch {
        stored = {};
      }
    }
    this.profileCache = { ...DEFAULT_COMPANY_PROFILE, ...stored, address: { ...EMPTY_ADDRESS, ...(stored.address ?? {}) } };
    return this.profileCache;
  }

  async updateProfile(patch: Partial<Omit<CompanyProfile, 'address'>> & { address?: Partial<Address> }): Promise<CompanyProfile> {
    const current = await this.profile();
    const address: Address = { ...current.address };
    for (const key of ['street', 'postalCode', 'city', 'country'] as const) {
      const value = patch.address?.[key];
      if (value !== undefined) address[key] = value;
    }
    const next: CompanyProfile = { ...current, ...patch, address };
    if (next.iban) next.iban = normalizeIban(next.iban);
    if (!/\{N+\}/.test(next.invoiceNumberPattern)) next.invoiceNumberPattern = DEFAULT_COMPANY_PROFILE.invoiceNumberPattern;
    this.profileCache = next;
    await this.db.settings.set(PROFILE_KEY, JSON.stringify(next), this.clock.nowISO());
    return next;
  }

  // ---------------------------------------------------------------------------
  // Communication styles (§97)
  // ---------------------------------------------------------------------------

  async communicationPreferences(): Promise<CommunicationPreferences> {
    if (this.styleCache) return this.styleCache;
    const raw = await this.db.settings.get(STYLE_KEY);
    let stored: Partial<CommunicationPreferences> = {};
    if (raw) {
      try {
        stored = JSON.parse(raw) as Partial<CommunicationPreferences>;
      } catch {
        stored = {};
      }
    }
    this.styleCache = { ...DEFAULT_COMMUNICATION_PREFERENCES, ...stored, audiences: { ...DEFAULT_COMMUNICATION_PREFERENCES.audiences, ...(stored.audiences ?? {}) }, rules: stored.rules ?? [] };
    return this.styleCache;
  }

  /** Explicit preference set by the user; nothing is learned implicitly. */
  async setStyle(target: { audience?: Audience | null; contactId?: string | null; default?: boolean }, style: CommunicationStyle): Promise<CommunicationPreferences> {
    const prefs = await this.communicationPreferences();
    if (target.contactId) {
      const contact = await this.db.contacts.getById(target.contactId);
      if (!contact) throw new DomainError('NOT_FOUND', 'Contact not found');
      await this.db.contacts.update({ ...contact, stylePreference: style, updatedAt: this.clock.nowISO() });
      return prefs;
    }
    const next: CommunicationPreferences = target.audience ? { ...prefs, audiences: { ...prefs.audiences, [target.audience]: style } } : { ...prefs, default: style };
    this.styleCache = next;
    await this.db.settings.set(STYLE_KEY, JSON.stringify(next), this.clock.nowISO());
    return next;
  }

  async addStyleRule(rule: string): Promise<CommunicationPreferences> {
    const prefs = await this.communicationPreferences();
    const next = { ...prefs, rules: Array.from(new Set([...prefs.rules, rule.trim()])).slice(0, 20) };
    this.styleCache = next;
    await this.db.settings.set(STYLE_KEY, JSON.stringify(next), this.clock.nowISO());
    return next;
  }

  async styleFor(contact: Contact | null, audienceHint: Audience | null = null): Promise<CommunicationStyle> {
    const prefs = await this.communicationPreferences();
    if (contact?.stylePreference) return contact.stylePreference;
    const audience = contact?.audience ?? audienceHint;
    if (audience && prefs.audiences[audience]) return prefs.audiences[audience] as CommunicationStyle;
    return prefs.default;
  }

  // ---------------------------------------------------------------------------
  // Companies
  // ---------------------------------------------------------------------------

  async createCompany(input: CompanyInput): Promise<Company> {
    const name = input.name.trim();
    if (!name) throw new DomainError('VALIDATION_FAILED', 'Company name is empty');
    const now = this.clock.nowISO();
    const company: Company = {
      id: newId(),
      name,
      legalName: input.legalName ?? null,
      kind: input.kind ?? 'client',
      vatNumber: input.vatNumber ?? null,
      companyNumber: input.companyNumber ?? null,
      address: { ...EMPTY_ADDRESS, ...(input.address ?? {}) },
      email: input.email ?? null,
      phone: input.phone ?? null,
      paymentTermsDays: input.paymentTermsDays ?? null,
      defaultTaxRate: input.defaultTaxRate ?? null,
      iban: input.iban ? normalizeIban(input.iban) : null,
      notes: input.notes ?? null,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.companies.insert(company);
    return company;
  }

  async updateCompany(id: string, patch: Partial<CompanyInput> & { archived?: boolean }): Promise<Company> {
    const company = await this.db.companies.getById(id);
    if (!company) throw new DomainError('NOT_FOUND', 'Company not found');
    const next: Company = {
      ...company,
      ...patch,
      name: patch.name?.trim() || company.name,
      address: { ...company.address, ...(patch.address ?? {}) },
      iban: patch.iban === undefined ? company.iban : patch.iban ? normalizeIban(patch.iban) : null,
      kind: patch.kind ?? company.kind,
      archived: patch.archived ?? company.archived,
      updatedAt: this.clock.nowISO(),
    } as Company;
    await this.db.companies.update(next);
    return next;
  }

  getCompany(id: string): Promise<Company | null> {
    return this.db.companies.getById(id);
  }

  listCompanies(kind: CompanyKind | null = null): Promise<Company[]> {
    return this.db.companies.list({ kind });
  }

  /** Fuzzy match on name / legal name ("GO!", "klant X", "Weston"). */
  async findCompany(query: string, kind: CompanyKind | null = null): Promise<MatchResult<Company>> {
    const companies = await this.db.companies.list({ kind });
    const exact = companies.filter((c) => c.name.toLowerCase() === query.trim().toLowerCase() || c.legalName?.toLowerCase() === query.trim().toLowerCase());
    if (exact.length === 1) return { best: exact[0] ?? null, score: 1, ambiguous: false, candidates: exact.map((item) => ({ item, score: 1 })) };
    return findBestMatch(query, companies, (c) => `${c.name} ${c.legalName ?? ''}`, 0.5);
  }

  async resolveCompany(query: string, kind: CompanyKind | null = null): Promise<Company> {
    const match = await this.findCompany(query, kind);
    if (!match.best) throw new DomainError('NOT_FOUND', `No company matches "${query}"`, { details: { query } });
    if (match.ambiguous) throw new DomainError('AMBIGUOUS_COMMAND', 'Several companies match', { details: { candidates: match.candidates.map((c) => ({ id: c.item.id, title: c.item.name })) } });
    return match.best;
  }

  /** Finds the supplier/customer of an extracted invoice by IBAN, VAT number or name. */
  async matchCounterparty(hints: { name?: string | null; iban?: string | null; vatNumber?: string | null }): Promise<Company | null> {
    if (hints.iban) {
      const byIban = await this.db.companies.findByIban(hints.iban);
      if (byIban) return byIban;
    }
    if (hints.vatNumber) {
      const byVat = await this.db.companies.findByVat(hints.vatNumber);
      if (byVat) return byVat;
    }
    if (hints.name) {
      const match = await this.findCompany(hints.name);
      if (match.best && !match.ambiguous && match.score >= 0.7) return match.best;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Contacts
  // ---------------------------------------------------------------------------

  async createContact(input: ContactInput): Promise<Contact> {
    const name = input.name.trim();
    if (!name) throw new DomainError('VALIDATION_FAILED', 'Contact name is empty');
    const now = this.clock.nowISO();
    const contact: Contact = {
      id: newId(),
      companyId: input.companyId ?? null,
      name,
      email: input.email?.trim().toLowerCase() ?? null,
      phone: input.phone ?? null,
      role: input.role ?? null,
      audience: input.audience ?? null,
      stylePreference: input.stylePreference ?? null,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.contacts.insert(contact);
    return contact;
  }

  async updateContact(id: string, patch: Partial<ContactInput>): Promise<Contact> {
    const contact = await this.db.contacts.getById(id);
    if (!contact) throw new DomainError('NOT_FOUND', 'Contact not found');
    const next: Contact = { ...contact, ...patch, name: patch.name?.trim() || contact.name, email: patch.email === undefined ? contact.email : (patch.email?.trim().toLowerCase() ?? null), updatedAt: this.clock.nowISO() } as Contact;
    await this.db.contacts.update(next);
    return next;
  }

  getContact(id: string): Promise<Contact | null> {
    return this.db.contacts.getById(id);
  }

  listContacts(companyId: string | null = null): Promise<Contact[]> {
    return this.db.contacts.list({ companyId });
  }

  async findContact(query: string): Promise<MatchResult<Contact>> {
    const contacts = await this.db.contacts.list();
    const q = query.trim().toLowerCase();
    const byEmail = contacts.find((c) => c.email === q);
    if (byEmail) return { best: byEmail, score: 1, ambiguous: false, candidates: [{ item: byEmail, score: 1 }] };
    return findBestMatch(query, contacts, (c) => c.name, 0.5);
  }

  async resolveContact(query: string): Promise<Contact> {
    const match = await this.findContact(query);
    if (!match.best) throw new DomainError('NOT_FOUND', `No contact matches "${query}"`, { details: { query } });
    if (match.ambiguous) throw new DomainError('AMBIGUOUS_COMMAND', 'Several contacts match', { details: { candidates: match.candidates.map((c) => ({ id: c.item.id, title: c.item.name })) } });
    return match.best;
  }

  /** Contact for an email address; creates nothing. */
  contactByEmail(email: string): Promise<Contact | null> {
    return this.db.contacts.findByEmail(email);
  }

  /** Looks up or creates a contact for an email sender; the company is attached only when the domain matches an existing company email. */
  async ensureContactForEmail(address: { name: string | null; email: string }): Promise<Contact> {
    const existing = await this.db.contacts.findByEmail(address.email);
    if (existing) return existing;
    const domain = address.email.split('@')[1]?.toLowerCase() ?? '';
    const companies = await this.db.companies.list();
    const company = domain ? companies.find((c) => c.email?.toLowerCase().endsWith(`@${domain}`)) : undefined;
    return this.createContact({ name: address.name?.trim() || address.email, email: address.email, companyId: company?.id ?? null, audience: company ? (company.kind === 'supplier' ? 'supplier' : 'client') : null });
  }
}
