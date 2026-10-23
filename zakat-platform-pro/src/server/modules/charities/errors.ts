import { AppError } from '@/lib/errors'

export class CharityNotFoundError extends AppError {
  constructor(message = 'Deze organisatie bestaat niet.') {
    super(message, { status: 404, code: 'CHARITY_NOT_FOUND' })
  }
}

export class CharitySourceNotFoundError extends AppError {
  constructor(message = 'Deze bron bestaat niet.') {
    super(message, { status: 404, code: 'CHARITY_SOURCE_NOT_FOUND' })
  }
}

export class CharityClaimNotFoundError extends AppError {
  constructor(message = 'Deze claim bestaat niet.') {
    super(message, { status: 404, code: 'CHARITY_CLAIM_NOT_FOUND' })
  }
}

/**
 * Raised when evidence does not support the claim it is attached to — for
 * example marking Zakat eligibility as independently verified while pointing at
 * the charity's own website (§11).
 */
export class InsufficientEvidenceError extends AppError {
  constructor(message: string) {
    super(message, { status: 422, code: 'INSUFFICIENT_EVIDENCE' })
  }
}

export class SourceCharityMismatchError extends AppError {
  constructor(message = 'Deze bron hoort niet bij deze organisatie.') {
    super(message, { status: 422, code: 'SOURCE_CHARITY_MISMATCH' })
  }
}
