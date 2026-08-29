/**
 * Types voor het databaseschema.
 *
 * Handgeschreven en bewust beperkt tot wat de app gebruikt. Te hergenereren met
 * `npx supabase gen types typescript --local > src/lib/supabase/types.ts` zodra
 * er een lokale Supabase-instantie draait; tot dan is dit de bron van waarheid
 * en moet hij mee met de migraties in supabase/migrations/.
 */

export type AppLanguage = 'nl' | 'fr';
export type AppRole = 'USER' | 'ADMIN';
export type SubscriptionStatus =
  | 'NONE'
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED';

export type DepositType =
  | 'INDIVIDUAL_ACCOUNT'
  | 'BANK_GUARANTEE_CPAS'
  | 'PROGRESSIVE_BANK_GUARANTEE'
  | 'REAL_SECURITY'
  | 'PERSONAL_SURETY'
  | 'OTHER'
  | 'UNKNOWN';

export type InspectionType = 'CHECK_IN' | 'CHECK_OUT';
export type InspectionStatus = 'DRAFT' | 'COMPLETED' | 'SIGNED_BY_LANDLORD';
export type DamageClassification = 'WEAR_AND_TEAR' | 'DAMAGE' | 'UNCLEAR';
export type LegalRuleStatus = 'VERIFIED' | 'UNVERIFIED' | 'STALE';
export type LetterReviewStatus = 'PLACEHOLDER' | 'REVIEWED';
export type NoticeType =
  | 'DEPOSIT_CLAIM'
  | 'INDEXATION_DISPUTE'
  | 'DEFECT_NOTICE'
  | 'RENT_GRID_DISCUSSION';
export type NoticeStatus =
  | 'DRAFT'
  | 'USER_APPROVED'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED';
export type SendChannel =
  | 'SELF_SERVICE'
  | 'EMAIL_PLAIN'
  | 'QERDS'
  | 'HYBRID_POST';
export type FindingSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type PebRating = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export type Profile = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  language: AppLanguage;
  role: AppRole;
  stripe_customer_id: string | null;
  subscription_status: SubscriptionStatus;
  subscription_current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export type Property = {
  id: string;
  user_id: string;
  address: string;
  postal_code: string;
  municipality: string;
  monthly_rent: number | null;
  monthly_charges: number | null;
  deposit_amount: number | null;
  deposit_type: DepositType;
  lease_signed_on: string | null;
  lease_start: string | null;
  lease_end: string | null;
  lease_registered: boolean | null;
  peb_certificate_provided: boolean | null;
  peb_rating: PebRating | null;
  surface_m2: number | null;
  bedrooms: number | null;
  landlord_name: string | null;
  landlord_address: string | null;
  landlord_email: string | null;
  retention_years: number;
  retention_notice_sent_at: string | null;
  scheduled_deletion_at: string | null;
  created_at: string;
  updated_at: string;
}

export type Inspection = {
  id: string;
  property_id: string;
  type: InspectionType;
  status: InspectionStatus;
  inspection_date: string;
  pdf_path: string | null;
  pdf_generated_at: string | null;
  landlord_invite_token_hash: string | null;
  landlord_invite_sent_at: string | null;
  landlord_invite_expires_at: string | null;
  landlord_signed_at: string | null;
  landlord_signature_name: string | null;
  landlord_signature_ip: string | null;
  created_at: string;
  updated_at: string;
}

export type InspectionRoom = {
  id: string;
  inspection_id: string;
  room_key: string;
  display_name: string;
  position: number;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
}

export type InspectionPhoto = {
  id: string;
  inspection_id: string;
  room_id: string | null;
  room: string;
  label: string;
  storage_path: string;
  sha256: string;
  byte_size: number;
  content_type: string;
  exif: Record<string, unknown> | null;
  captured_at: string | null;
  uploaded_at: string;
  note: string | null;
  created_at: string;
}

export type PhotoComparison = {
  id: string;
  checkin_photo_id: string;
  checkout_photo_id: string;
  ai_classification: DamageClassification | null;
  ai_confidence: number | null;
  ai_notes: string | null;
  ai_provider: string | null;
  ai_model: string | null;
  ai_analyzed_at: string | null;
  estimated_cost_low: number | null;
  estimated_cost_high: number | null;
  cost_reference_id: string | null;
  ai_observed_differences: string[];
  ai_forced_unclear: boolean;
  ai_refused: boolean;
  ai_suggested_item_keys: string[];
  vetuste_item_key: string | null;
  equipment_age_at_entry_years: number | null;
  repair_cost_cents: number | null;
  repair_cost_source: 'QUOTE' | 'REFERENCE_TABLE' | null;
  vetuste_exclusion: string | null;
  vetuste_abattement_pct: number | null;
  tenant_share_cents: number | null;
  landlord_share_cents: number | null;
  vetuste_calculated_at: string | null;
  user_verdict: DamageClassification | null;
  user_note: string | null;
  user_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type LegalRule = {
  rule_key: string;
  description_nl: string;
  description_fr: string;
  parameters: Record<string, unknown>;
  source_url: string;
  source_name: string;
  source_is_official: boolean;
  verified_at: string;
  status: LegalRuleStatus;
  applies_from: string | null;
  applies_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type LetterTemplate = {
  id: string;
  template_key: string;
  language: AppLanguage;
  version: number;
  title: string;
  body: string;
  required_rule_keys: string[];
  legal_review_status: LetterReviewStatus;
  legal_reviewed_by: string | null;
  legal_reviewed_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type DepositCase = {
  id: string;
  property_id: string;
  keys_returned_on: string;
  deposit_amount: number;
  landlord_claimed_amount: number | null;
  landlord_claim_reason: string | null;
  landlord_claim_received_on: string | null;
  amount_refunded: number | null;
  refunded_on: string | null;
  deadline_date: string | null;
  deadline_rule_key: string | null;
  iban: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export type LegalNotice = {
  id: string;
  property_id: string;
  deposit_case_id: string | null;
  type: NoticeType;
  language: AppLanguage;
  template_id: string;
  template_key: string;
  template_version: number;
  rule_snapshot: Record<string, unknown>;
  merge_fields: Record<string, unknown>;
  status: NoticeStatus;
  amount_claimed: number | null;
  pdf_path: string | null;
  pdf_sha256: string | null;
  user_approved_at: string | null;
  user_approval_ip: string | null;
  sent_via: SendChannel | null;
  provider_reference: string | null;
  provider_proof: Record<string, unknown> | null;
  sent_at: string | null;
  delivered_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type ContractScan = {
  id: string;
  property_id: string;
  storage_path: string;
  sha256: string;
  extracted_text: string | null;
  extraction_method: string | null;
  findings: ContractFinding[];
  scanned_at: string | null;
  user_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ContractFinding = {
  check_key: string;
  clause_quote: string;
  category: string;
  explanation: string;
  rule_key: string | null;
  severity: FindingSeverity;
  user_dismissed?: boolean;
}

export type RepairCostReference = {
  id: string;
  category: string;
  item_key: string;
  label_nl: string;
  label_fr: string;
  unit: string;
  cost_low: number;
  cost_high: number;
  source_name: string;
  source_url: string | null;
  valid_from: string;
  is_active: boolean;
}

export type HealthIndexValue = {
  id: string;
  year: number;
  month: number;
  base_year: number;
  value: number;
  source_name: string;
  source_url: string | null;
  published_at: string | null;
}

export type Entitlement = {
  id: string;
  user_id: string;
  plan_key: string;
  property_id: string | null;
  source: 'STRIPE' | 'FREE_TIER' | 'MANUAL';
  stripe_checkout_session_id: string | null;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

export type PricingConfig = {
  id: string;
  plan_key: string;
  label_nl: string;
  label_fr: string;
  kind: 'SUBSCRIPTION' | 'ONE_OFF';
  amount_cents: number;
  currency: string;
  stripe_price_id: string | null;
  is_active: boolean;
}


export type AuditAction =
  | 'DOCUMENT_VIEW'
  | 'DOCUMENT_DOWNLOAD'
  | 'PHOTO_VIEW'
  | 'NOTICE_SENT'
  | 'NOTICE_APPROVED'
  | 'DATA_EXPORT'
  | 'DATA_DELETION'
  | 'LANDLORD_REPORT_VIEW'
  | 'LANDLORD_SIGNED';

export type AuditLog = {
  id: number;
  user_id: string | null;
  action: AuditAction;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export type DepositReminder = {
  id: string;
  deposit_case_id: string;
  remind_at: string;
  kind: string;
  sent_at: string | null;
  created_at: string;
}

export type RentAudit = {
  id: string;
  property_id: string;
  kind: 'RENT_GRID' | 'INDEXATION';
  inputs: Record<string, unknown>;
  result: Record<string, unknown>;
  rule_snapshot: Record<string, unknown>;
  needs_verification: boolean;
  created_at: string;
}

export type VetusteReference = {
  id: string;
  item_key: string;
  category: string;
  label_source_fr: string;
  label_nl: string;
  label_fr: string;
  lifetime_years: number;
  abattement_pct: number;
  franchise_years: number;
  residual_value_pct: number;
  source_name: string;
  source_url: string | null;
  source_region: string;
  is_binding_in_brussels: boolean;
  created_at: string;
}

export type ContractClauseCheck = {
  id: string;
  check_key: string;
  category: string;
  label_nl: string;
  label_fr: string;
  explanation_nl: string;
  explanation_fr: string;
  patterns_nl: string[];
  patterns_fr: string[];
  rule_key: string | null;
  severity: FindingSeverity;
  is_active: boolean;
  created_at: string;
}

export type KbDocument = {
  id: string;
  doc_key: string;
  title_nl: string;
  title_fr: string;
  source_name: string;
  source_url: string;
  source_is_official: boolean;
  language: AppLanguage;
  retrieved_at: string;
  is_active: boolean;
  created_at: string;
}

export type KbChunk = {
  id: string;
  document_id: string;
  position: number;
  content: string;
  created_at: string;
}

export type StripeEvent = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  processed_at: string | null;
  error: string | null;
  received_at: string;
}

export type VisionUsage = {
  id: string;
  user_id: string;
  comparison_id: string | null;
  provider: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_estimate_cents: number | null;
  created_at: string;
}

export type DeletionRequest = {
  id: string;
  user_id: string;
  requested_at: string;
  execute_after: string;
  executed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

type Row<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  // supabase-js verwacht dit veld op elke tabel; zonder dit valt de
  // typeafleiding terug op `never` en verliezen alle queries hun types.
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Row<Profile>;
      properties: Row<Property>;
      inspections: Row<Inspection>;
      inspection_rooms: Row<InspectionRoom>;
      inspection_photos: Row<InspectionPhoto>;
      photo_comparisons: Row<PhotoComparison>;
      legal_rules: Row<LegalRule>;
      letter_templates: Row<LetterTemplate>;
      deposit_cases: Row<DepositCase>;
      legal_notices: Row<LegalNotice>;
      contract_scans: Row<ContractScan>;
      repair_cost_reference: Row<RepairCostReference>;
      health_index_values: Row<HealthIndexValue>;
      entitlements: Row<Entitlement>;
      pricing_config: Row<PricingConfig>;
      audit_log: Row<AuditLog>;
      deposit_reminders: Row<DepositReminder>;
      rent_audits: Row<RentAudit>;
      vetuste_reference: Row<VetusteReference>;
      contract_clause_checks: Row<ContractClauseCheck>;
      kb_documents: Row<KbDocument>;
      kb_chunks: Row<KbChunk>;
      stripe_events: Row<StripeEvent>;
      vision_usage: Row<VisionUsage>;
      deletion_requests: Row<DeletionRequest>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
