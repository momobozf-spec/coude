/** Property matching domain types. */

export interface PropertyCandidate {
  id: string;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  surfaceArea: number | null;
  bedrooms: number | null;
  /** Most recent known price across listings of this property, if any */
  lastKnownPrice?: number | null;
  /** Description of the most recent listing, for similarity checks */
  lastDescription?: string | null;
  /** Known seller phones (E.164) across this property's listings */
  sellerPhones?: string[];
}

export interface MatchResult {
  propertyId?: string;
  confidence: number; // 0..1
  reasons: string[];
  decision: "AUTO_MATCH" | "REVIEW" | "NO_MATCH";
}
