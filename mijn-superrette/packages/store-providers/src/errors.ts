export class ProviderError extends Error {
  constructor(
    message: string,
    readonly providerKey: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/** The provider has no legal/reliable integration. */
export class ProviderUnsupportedError extends ProviderError {
  constructor(providerKey: string, reason: string) {
    super(`Provider "${providerKey}" is UNSUPPORTED: ${reason}`, providerKey);
    this.name = 'ProviderUnsupportedError';
  }
}

/** The provider works, but not for this operation. */
export class ProviderCapabilityError extends ProviderError {
  constructor(providerKey: string, capability: string) {
    super(`Provider "${providerKey}" does not support ${capability}`, providerKey);
    this.name = 'ProviderCapabilityError';
  }
}

export class ProviderHttpError extends ProviderError {
  constructor(
    providerKey: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(`Provider "${providerKey}" request failed with HTTP ${status}: ${url}`, providerKey);
    this.name = 'ProviderHttpError';
  }
}
