# Beslisboom — hoe een status tot stand komt

Dit document legt vast hoe `Product.halalStatus` en `ProductAnalysis.status`
bepaald worden. Het is de specificatie voor de rules engine (Fase 3) en de
referentie voor de tests.

Grondregel: **twijfel wordt zichtbaar gemaakt, niet weggerond.**

---

## 1. Statussen

| Status | Betekenis | Wanneer |
|---|---|---|
| `CERTIFIED_HALAL` | Geldig geverifieerd certificaat | Actief certificaat én geen conflict met de ingrediënten |
| `LIKELY_HALAL` | Geen problemen gevonden, geen certificaat | Alle ingrediënten bekend en onproblematisch |
| `MUSHBOOH` | Herkomst van ≥1 ingrediënt niet vast te stellen | Twijfelgeval aangetroffen, of veel onbekende ingrediënten |
| `LIKELY_HARAM` | Sterke aanwijzing, geen bevestiging | Bv. een alias-match op een verboden ingrediënt met lage zekerheid |
| `HARAM` | Expliciet verboden ingrediënt | Directe match op een `HARAM`-ingrediënt |
| `UNKNOWN` | Te weinig data | Geen ingrediëntenlijst beschikbaar |

`MUSHBOOH` vs. `UNKNOWN`: gebruik `UNKNOWN` als er **geen** informatie is (lege
ingrediëntenlijst, product niet gevonden). Gebruik `MUSHBOOH` als er **wél**
informatie is, maar die informatie leidt tot twijfel.

---

## 2. Ingrediëntenanalyse

```
Ruwe ingrediëntentekst
   ↓ ontbreekt?  ────────────────────────────►  UNKNOWN / confidence LOW
   ↓                                            finding: MISSING_DATA
Normaliseren  (accenten, leestekens, percentages)
   ↓
Splitsen  (komma's, haakjesniveau bewaken)
   ↓
Per item:
   ├─ E-nummer herkend?  ──►  ENumber opzoeken  ──►  status uit ENumber
   ├─ Exacte match op Ingredient.normalizedName of IngredientAlias?
   │                          ──►  status uit Ingredient
   └─ Geen match  ──────────────►  finding UNKNOWN_INGREDIENT
   ↓
Statussen samenvoegen (§3)
```

### Prioriteit binnen één ingrediënt

Een specifiekere match wint van een algemenere. `"varkensgelatine"` matcht op
het `HARAM`-ingrediënt varkensgelatine, niet op het `MUSHBOOH`-ingrediënt
gelatine. In de praktijk: probeer eerst de langste alias-match.

Vermelde herkomst overrulet de standaard. `"plantaardige mono- en
diglyceriden"` is niet hetzelfde geval als kaal `"E471"`; de herkomst staat er
dan wél bij.

---

## 3. Samenvoegen van ingrediëntstatussen

De laagste status wint. Volgorde van slecht naar goed:

```
HARAM  >  LIKELY_HARAM  >  MUSHBOOH  >  UNKNOWN  >  LIKELY_HALAL
```

Concreet:

| Situatie | Resultaat |
|---|---|
| Eén of meer `HARAM`-ingrediënten | `HARAM`, confidence `HIGH` |
| Geen haram, wel `LIKELY_HARAM` | `LIKELY_HARAM` |
| Geen (likely) haram, wel ≥1 `MUSHBOOH` | `MUSHBOOH` |
| Geen twijfelgevallen, wel onbekende ingrediënten | `MUSHBOOH` als het aandeel onbekend hoog is, anders `LIKELY_HALAL` met lagere confidence |
| Alles bekend en onproblematisch | `LIKELY_HALAL` |

### Confidence

| Niveau | Wanneer |
|---|---|
| `HIGH` | Beslissende match op een bekend ingrediënt/E-nummer met `defaultConfidence: HIGH` |
| `MEDIUM` | Match met `defaultConfidence: MEDIUM`, of enkele onbekende ingrediënten |
| `LOW` | Veel onbekende ingrediënten, of de status leunt op een zwakke aanwijzing |

Confidence gaat over de **zekerheid van de uitspraak**, niet over hoe goed het
product is. `HARAM` met `HIGH` betekent: we weten zeker dat dit niet halal is.

---

## 4. Certificaten

Een certificaat telt alleen mee als het **actief** is:

```
status == VERIFIED   EN   (expiresAt IS NULL OF expiresAt >= vandaag)
```

Alle andere gevallen (`PENDING`, `COMMUNITY_REVIEWED`, `REJECTED`, `EXPIRED`,
of `VERIFIED` maar verlopen) leveren **geen** positieve bewijskracht. De UI
toont dan "Certificaat in verificatie" of "Certificaat verlopen" — nooit een
groene badge.

### Levenscyclus

```
Upload  ──►  PENDING
              ↓ metadata-extractie, community/admin review
              ├──►  COMMUNITY_REVIEWED  ──►  VERIFIED   (alleen moderator/admin)
              └──►  REJECTED

VERIFIED  ──►  expiresAt < vandaag  ──►  EXPIRED
```

Een geüploade certificaat wordt **nooit** automatisch `VERIFIED`. Dat is de
belangrijkste anti-misbruikregel in het systeem: zonder die regel kan iedereen
een groene badge op een willekeurig product plakken.

---

## 5. Certificaat versus ingrediënten

Dit is de kern van §34 van de opdracht.

```
Actief geverifieerd certificaat aanwezig?
   │
   ├─ nee  ──►  status = uitkomst ingrediëntenanalyse
   │
   └─ ja
        │
        ├─ ingrediëntenanalyse = HARAM of LIKELY_HARAM
        │      ──►  CONFLICT
        │           status  = MUSHBOOH
        │           hasConflict = true
        │           needsHumanReview = true
        │           finding: FindingType.CONFLICT
        │
        ├─ ingrediëntenanalyse = MUSHBOOH
        │      ──►  status = CERTIFIED_HALAL, confidence MEDIUM
        │           De twijfelgevallen blijven wél als finding zichtbaar;
        │           een certificerende instantie heeft de herkomst normaal
        │           gesproken bij de fabrikant geverifieerd.
        │
        └─ ingrediëntenanalyse = LIKELY_HALAL of UNKNOWN
               ──►  status = CERTIFIED_HALAL, confidence HIGH
```

Waarom bij een conflict `MUSHBOOH` en niet `HARAM`: beide signalen zijn
betrouwbaar genoeg om niet genegeerd te worden, en niet betrouwbaar genoeg om
de ander te overrulen. Het certificaat kan verouderd zijn, de ingrediëntenlijst
kan van een andere batch komen. De eerlijke uitkomst is "we weten het niet" plus
een vlag voor menselijke review.

**Een expliciet haram ingrediënt maakt de status nooit automatisch groen** —
ook niet als een AI-model of een community-review beweert dat het product halal
is.

---

## 6. Wat AI wél en niet mag

| Mag | Mag niet |
|---|---|
| OCR-tekst opschonen | Een status bepalen |
| Ingrediëntnamen normaliseren/vertalen | Een ingrediënt als halal bestempelen |
| Complexe ingrediëntentekst structureren | Een bron verzinnen |
| De findings in gewone taal uitleggen | Een certificaat "bevestigen" |

De pijplijn is altijd:

```
AI-output  ──►  Zod-validatie  ──►  rules engine  ──►  status
```

nooit:

```
AI  ──►  status
```

AI-output die door de engine gaat, wordt gemarkeerd met
`IngredientOrigin.AI_ASSISTED`, zodat in de UI zichtbaar blijft dat de
ingrediëntenlijst niet rechtstreeks van het etiket of van Open Food Facts komt.

---

## 7. Community-informatie

Community-reviews en votes beïnvloeden de status **niet**. Ze zijn zichtbaar op
het tabblad Community en kunnen een `Report` uitlokken die een moderator
oppakt. Reden: anders is de status manipuleerbaar door een groep gebruikers.

Een review kan wel leiden tot een *herziening* — bijvoorbeeld een moderator die
de ingrediëntenlijst corrigeert, waarna de engine opnieuw draait en een nieuwe
`ProductAnalysis` ontstaat.
