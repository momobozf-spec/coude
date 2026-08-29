/**
 * Database types, matching supabase/migrations/ exactly.
 *
 * Hand-maintained rather than generated, because generation requires a live
 * project and this repository must type-check in CI without credentials.
 * When you change a migration, change this file in the same commit — the
 * integration tests run the real migrations, so a drift shows up there.
 */

export type LanguageCode = 'nl' | 'fr'

export type SubscriptionStatus = 'FREE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED'

export type TicketType =
  | 'SINGLE_TICKET'
  | 'RETURN_TICKET'
  | 'SUBSCRIPTION_1M'
  | 'SUBSCRIPTION_3M'
  | 'SUBSCRIPTION_12M'

export type ClaimType = 'SINGLE_DELAY' | 'FREQUENT_DELAYS'

export type ClaimStatus =
  | 'DETECTED'
  | 'AWAITING_USER_CONFIRMATION'
  | 'CONFIRMED'
  | 'IN_ADMIN_REVIEW'
  | 'SUBMITTED'
  | 'AWAITING_NMBS'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED'

export type StatusEventSource = 'SYSTEM' | 'USER' | 'ADMIN' | 'INBOUND_EMAIL'

export type TripMeasurementStatus = 'PENDING' | 'MEASURED' | 'INCONCLUSIVE'

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface ProfileRow {
  id: string
  user_id: string
  full_name: string
  email: string
  iban_encrypted: string | null
  mobib_number_encrypted: string | null
  ticket_type: TicketType | null
  ticket_price_cents: number | null
  language: LanguageCode
  stripe_customer_id: string | null
  subscription_status: SubscriptionStatus
  subscription_current_period_end: string | null
  created_at: string
  updated_at: string
}

export interface CommuteRouteRow {
  id: string
  user_id: string
  departure_station_id: string
  arrival_station_id: string
  departure_station_name: string
  arrival_station_name: string
  preferred_departure_time: string
  days_of_week: number[]
  active: boolean
  created_at: string
  updated_at: string
}

export interface MonitoredTripRow {
  id: string
  route_id: string
  user_id: string
  service_date: string
  train_number: string | null
  vehicle_id: string | null
  scheduled_departure: string | null
  scheduled_arrival: string | null
  actual_arrival_delay_minutes: number | null
  cancelled: boolean
  measurement_status: TripMeasurementStatus
  irail_snapshot: Json | null
  checked_at: string | null
  attempts: number
  created_at: string
}

export interface ClaimRow {
  id: string
  user_id: string
  monitored_trip_id: string | null
  claim_type: ClaimType
  status: ClaimStatus
  user_confirmed_at: string | null
  confirmation_ip: string | null
  claim_pdf_path: string | null
  submitted_at: string | null
  submission_window_opens_at: string | null
  deadline_at: string
  compensation_amount_expected_cents: number | null
  compensation_amount_received_cents: number | null
  rules_snapshot: Json | null
  created_at: string
  updated_at: string
}

export interface ClaimStatusEventRow {
  id: string
  claim_id: string
  status: ClaimStatus
  source: StatusEventSource
  note: string | null
  actor_id: string | null
  created_at: string
}

export interface CompensationRuleDbRow {
  rule_key: string
  parameters: Json
  source_url: string
  verified_at: string
  updated_at: string
}

export interface MandateRow {
  id: string
  user_id: string
  accepted_at: string
  ip: string
  user_agent: string | null
  text_version: string
  created_at: string
}

export interface NotificationRow {
  id: string
  user_id: string
  claim_id: string | null
  kind: string
  channel: 'EMAIL' | 'PUSH'
  sent_at: string | null
  error: string | null
  created_at: string
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
}

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        Omit<ProfileRow, 'id' | 'created_at' | 'updated_at'> & { id?: string }
      >
      commute_routes: Table<
        CommuteRouteRow,
        Omit<CommuteRouteRow, 'id' | 'created_at' | 'updated_at' | 'active'> & {
          id?: string
          active?: boolean
        }
      >
      monitored_trips: Table<
        MonitoredTripRow,
        Omit<MonitoredTripRow, 'id' | 'created_at' | 'attempts' | 'cancelled'> & {
          id?: string
          attempts?: number
          cancelled?: boolean
        }
      >
      claims: Table<
        ClaimRow,
        Omit<ClaimRow, 'id' | 'created_at' | 'updated_at' | 'status'> & {
          id?: string
          status?: ClaimStatus
        }
      >
      claim_status_events: Table<ClaimStatusEventRow>
      claim_trips: Table<{
        claim_id: string
        monitored_trip_id: string
        delay_minutes: number
      }>
      compensation_rules: Table<CompensationRuleDbRow>
      mandates: Table<
        MandateRow,
        Omit<MandateRow, 'id' | 'created_at' | 'accepted_at'> & {
          id?: string
          accepted_at?: string
        }
      >
      notifications: Table<NotificationRow>
      stripe_events: Table<{
        id: string
        type: string
        payload: Json
        processed_at: string | null
        error: string | null
        created_at: string
      }>
      worker_heartbeats: Table<{
        worker_name: string
        beat_at: string
        detail: Json | null
      }>
      app_settings: Table<{
        key: string
        value: Json
        updated_at: string
        updated_by: string | null
      }>
      admin_users: Table<{ user_id: string; created_at: string }>
    }
    Views: Record<string, never>
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
      confirm_claim: { Args: { p_claim_id: string; p_ip: string }; Returns: ClaimRow }
    }
    Enums: {
      language_code: LanguageCode
      subscription_status: SubscriptionStatus
      ticket_type: TicketType
      claim_type: ClaimType
      claim_status: ClaimStatus
      status_event_source: StatusEventSource
      trip_measurement_status: TripMeasurementStatus
    }
    CompositeTypes: Record<string, never>
  }
}
