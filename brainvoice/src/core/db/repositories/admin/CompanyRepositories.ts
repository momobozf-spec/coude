import { fromBool, nullable, numberOrNull, parseJson, toBool, toJson, type SqlExecutor, type SqlValue } from '../../SqlDriver';
import { EMPTY_ADDRESS, type Address, type Audience, type CommunicationStyle, type Company, type CompanyKind, type Contact } from '../../../domain/admin';

type Row = Record<string, SqlValue>;

function rowToCompany(r: Row): Company {
  return {
    id: String(r.id),
    name: String(r.name),
    legalName: nullable(r.legal_name),
    kind: String(r.kind) as CompanyKind,
    vatNumber: nullable(r.vat_number),
    companyNumber: nullable(r.company_number),
    address: { ...EMPTY_ADDRESS, ...parseJson<Partial<Address>>(r.address_json, {}) },
    email: nullable(r.email),
    phone: nullable(r.phone),
    paymentTermsDays: numberOrNull(r.payment_terms_days),
    defaultTaxRate: numberOrNull(r.default_tax_rate),
    iban: nullable(r.iban),
    notes: nullable(r.notes),
    archived: toBool(r.archived),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export class CompanyRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(c: Company): Promise<void> {
    await this.db.run(
      `INSERT INTO companies (id, name, legal_name, kind, vat_number, company_number, address_json, email, phone, payment_terms_days, default_tax_rate, iban, notes, archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.id, c.name, c.legalName, c.kind, c.vatNumber, c.companyNumber, toJson(c.address), c.email, c.phone, c.paymentTermsDays, c.defaultTaxRate, c.iban, c.notes, fromBool(c.archived), c.createdAt, c.updatedAt],
    );
  }

  async update(c: Company): Promise<void> {
    await this.db.run(
      `UPDATE companies SET name = ?, legal_name = ?, kind = ?, vat_number = ?, company_number = ?, address_json = ?, email = ?, phone = ?, payment_terms_days = ?, default_tax_rate = ?, iban = ?, notes = ?, archived = ?, updated_at = ? WHERE id = ?`,
      [c.name, c.legalName, c.kind, c.vatNumber, c.companyNumber, toJson(c.address), c.email, c.phone, c.paymentTermsDays, c.defaultTaxRate, c.iban, c.notes, fromBool(c.archived), c.updatedAt, c.id],
    );
  }

  async getById(id: string): Promise<Company | null> {
    const row = await this.db.get<Row>('SELECT * FROM companies WHERE id = ?', [id]);
    return row ? rowToCompany(row) : null;
  }

  async getByIds(ids: string[]): Promise<Company[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.all<Row>(`SELECT * FROM companies WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    return rows.map(rowToCompany);
  }

  async list(options: { kind?: CompanyKind | null; includeArchived?: boolean; limit?: number } = {}): Promise<Company[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (!options.includeArchived) where.push('archived = 0');
    if (options.kind) {
      where.push("(kind = ? OR kind = 'both')");
      params.push(options.kind);
    }
    const rows = await this.db.all<Row>(`SELECT * FROM companies ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY name COLLATE NOCASE LIMIT ?`, [...params, options.limit ?? 500]);
    return rows.map(rowToCompany);
  }

  async findByIban(iban: string): Promise<Company | null> {
    const row = await this.db.get<Row>("SELECT * FROM companies WHERE replace(upper(iban), ' ', '') = ? AND archived = 0", [iban.replace(/\s/g, '').toUpperCase()]);
    return row ? rowToCompany(row) : null;
  }

  async findByVat(vatNumber: string): Promise<Company | null> {
    const row = await this.db.get<Row>("SELECT * FROM companies WHERE replace(replace(upper(vat_number), ' ', ''), '.', '') = ? AND archived = 0", [vatNumber.replace(/[\s.]/g, '').toUpperCase()]);
    return row ? rowToCompany(row) : null;
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM companies WHERE id = ?', [id]);
  }
}

function rowToContact(r: Row): Contact {
  return {
    id: String(r.id),
    companyId: nullable(r.company_id),
    name: String(r.name),
    email: nullable(r.email),
    phone: nullable(r.phone),
    role: nullable(r.role),
    audience: nullable(r.audience) as Audience | null,
    stylePreference: nullable(r.style_preference) as CommunicationStyle | null,
    notes: nullable(r.notes),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export class ContactRepository {
  constructor(private readonly db: SqlExecutor) {}

  async insert(c: Contact): Promise<void> {
    await this.db.run('INSERT INTO contacts (id, company_id, name, email, phone, role, audience, style_preference, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      c.id, c.companyId, c.name, c.email, c.phone, c.role, c.audience, c.stylePreference, c.notes, c.createdAt, c.updatedAt,
    ]);
  }

  async update(c: Contact): Promise<void> {
    await this.db.run('UPDATE contacts SET company_id = ?, name = ?, email = ?, phone = ?, role = ?, audience = ?, style_preference = ?, notes = ?, updated_at = ? WHERE id = ?', [
      c.companyId, c.name, c.email, c.phone, c.role, c.audience, c.stylePreference, c.notes, c.updatedAt, c.id,
    ]);
  }

  async getById(id: string): Promise<Contact | null> {
    const row = await this.db.get<Row>('SELECT * FROM contacts WHERE id = ?', [id]);
    return row ? rowToContact(row) : null;
  }

  async list(options: { companyId?: string | null; limit?: number } = {}): Promise<Contact[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (options.companyId) {
      where.push('company_id = ?');
      params.push(options.companyId);
    }
    const rows = await this.db.all<Row>(`SELECT * FROM contacts ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY name COLLATE NOCASE LIMIT ?`, [...params, options.limit ?? 500]);
    return rows.map(rowToContact);
  }

  async findByEmail(email: string): Promise<Contact | null> {
    const row = await this.db.get<Row>('SELECT * FROM contacts WHERE lower(email) = ?', [email.toLowerCase()]);
    return row ? rowToContact(row) : null;
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM contacts WHERE id = ?', [id]);
  }
}
