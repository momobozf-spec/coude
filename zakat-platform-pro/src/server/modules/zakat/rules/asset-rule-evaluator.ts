import type { AssetInput, AssetRuleSnapshot, RuleSetSnapshot } from '@/server/modules/zakat/types'

/**
 * Decides whether an asset counts, and for how much (§12).
 *
 * All of it comes from the ruleset rows. There is deliberately no
 * `if (asset.type === 'GOLD')` anywhere in this file: which categories are
 * zakatable is a religious position that must be versionable and sourceable, not
 * a branch compiled into a release.
 */

export interface AssetRuleDecision {
  included: boolean
  /** 0–100, as a decimal string. */
  percentage: string
  reason: string
  /** Which rule produced this, for the sources section. */
  ruleBasis: string
}

export function evaluateAsset(
  asset: AssetInput,
  ruleSet: RuleSetSnapshot,
): AssetRuleDecision {
  const rule = ruleSet.assetRules.get(asset.type)

  // A ruleset that does not mention a category has taken no position on it.
  // Excluding it is the honest default: silently counting it would attribute a
  // ruling to the ruleset that it never made.
  if (!rule) {
    return {
      included: false,
      percentage: '0',
      reason: `De regelset ${ruleSet.version} bevat geen regel voor deze categorie, dus telt deze post niet mee.`,
      ruleBasis: `${ruleSet.version} — geen regel`,
    }
  }

  if (!rule.zakatable) {
    return {
      included: false,
      percentage: '0',
      reason: rule.rationale ?? 'Deze categorie is volgens de gekozen regelset niet Zakat-plichtig.',
      ruleBasis: `${ruleSet.version} — ${asset.type}`,
    }
  }

  const percentage = resolvePercentage(asset, rule)
  const overridden = asset.zakatablePercentage !== null

  if (isZero(percentage)) {
    return {
      included: false,
      percentage: '0',
      reason: overridden
        ? 'Je hebt deze post zelf op 0% gezet, dus hij telt niet mee.'
        : (rule.rationale ?? 'Deze post telt volgens de regelset voor 0% mee.'),
      ruleBasis: overridden ? 'Eigen aanpassing' : `${ruleSet.version} — ${asset.type}`,
    }
  }

  return {
    included: true,
    percentage,
    reason: overridden
      ? `Je hebt deze post zelf op ${percentage}% gezet.`
      : (rule.rationale ?? `Telt voor ${percentage}% mee volgens de gekozen regelset.`),
    ruleBasis: overridden ? 'Eigen aanpassing' : `${ruleSet.version} — ${asset.type}`,
  }
}

/** A user override always wins over the ruleset default. */
function resolvePercentage(asset: AssetInput, rule: AssetRuleSnapshot): string {
  return asset.zakatablePercentage ?? rule.defaultZakatablePercentage
}

function isZero(value: string): boolean {
  return /^-?0(\.0+)?$/.test(value.trim())
}
