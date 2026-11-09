/**
 * Documentfouten met een stabiele code.
 *
 * Geen enkele Prisma- of storage-fout mag naar de browser: die bevatten
 * tabelnamen, bestandspaden en soms de sleutel zelf.
 */
import { AppError } from '@/lib/errors'

export type DocumentErrorCode =
  | 'DOCUMENT_NOT_FOUND'
  | 'DOCUMENT_NOT_READABLE'
  | 'DOCUMENT_ALREADY_DELETED'
  | 'UPLOAD_INVALID'
  | 'UPLOAD_TOO_LARGE'
  | 'UPLOAD_EMPTY'
  | 'UPLOAD_TYPE_NOT_ALLOWED'
  | 'UPLOAD_CONTENT_MISMATCH'
  | 'STORAGE_UNAVAILABLE'
  | 'STORAGE_KEY_INVALID'
  | 'LINK_TARGET_NOT_FOUND'
  | 'EXPLANATION_NOT_AVAILABLE'
  | 'EXPLANATION_NOT_SUPPORTED'
  | 'DOWNLOAD_TOKEN_INVALID'

export class DocumentError extends AppError {
  constructor(code: DocumentErrorCode, message: string, status = 400, details?: unknown) {
    super(message, status, code, details)
  }
}

export const documentErrors = {
  /**
   * Bewust 404 en niet 403, ook wanneer het document wél bestaat maar van
   * iemand anders is. Wie geen toegang heeft, hoort niet te kunnen afleiden
   * dát het bestaat — dat verschil is op zichzelf al informatie.
   */
  notFound: () => new DocumentError('DOCUMENT_NOT_FOUND', 'Document niet gevonden', 404),

  notReadable: (reason: string) =>
    new DocumentError('DOCUMENT_NOT_READABLE', reason, 409),

  alreadyDeleted: () =>
    new DocumentError('DOCUMENT_ALREADY_DELETED', 'Dit document is al verwijderd.', 409),

  uploadInvalid: (problems: string[]) =>
    new DocumentError(
      'UPLOAD_INVALID',
      problems[0] ?? 'Dit bestand kunnen we niet verwerken.',
      422,
      { problems },
    ),

  tooLarge: (maxBytes: number) =>
    new DocumentError(
      'UPLOAD_TOO_LARGE',
      `Het bestand is groter dan ${Math.round(maxBytes / 1024 / 1024)} MB.`,
      413,
    ),

  empty: () => new DocumentError('UPLOAD_EMPTY', 'Het bestand is leeg.', 422),

  typeNotAllowed: (mimeType: string) =>
    new DocumentError(
      'UPLOAD_TYPE_NOT_ALLOWED',
      `Bestandstype ${mimeType} is niet toegestaan. Toegestaan: PDF, JPG, PNG, HEIC en WEBP.`,
      415,
    ),

  contentMismatch: () =>
    new DocumentError(
      'UPLOAD_CONTENT_MISMATCH',
      'De inhoud van het bestand komt niet overeen met het opgegeven type.',
      422,
    ),

  storageUnavailable: () =>
    new DocumentError(
      'STORAGE_UNAVAILABLE',
      'De opslag is nu niet bereikbaar. Probeer het over enkele minuten opnieuw.',
      503,
    ),

  storageKeyInvalid: () =>
    new DocumentError('STORAGE_KEY_INVALID', 'Ongeldige opslagverwijzing.', 400),

  linkTargetNotFound: () =>
    new DocumentError(
      'LINK_TARGET_NOT_FOUND',
      'Datgene waaraan je dit document wil koppelen, bestaat niet of is niet van jou.',
      404,
    ),

  explanationNotAvailable: (reason: string) =>
    new DocumentError('EXPLANATION_NOT_AVAILABLE', reason, 503),

  explanationNotSupported: (reason: string) =>
    new DocumentError('EXPLANATION_NOT_SUPPORTED', reason, 422),

  downloadTokenInvalid: () =>
    new DocumentError(
      'DOWNLOAD_TOKEN_INVALID',
      'Deze downloadlink is verlopen of ongeldig. Open het document opnieuw.',
      403,
    ),
}
