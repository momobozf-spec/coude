"""Financieel model Familiestem. Alle aannames bovenaan; draai: python3 model.py"""
import sys
PRICE_INCL = float(sys.argv[1]) if len(sys.argv)>1 else 49.00  # testprijs incl. btw
VAT = 0.21                  # Belgisch btw-tarief, B2C in BE
USD_EUR = 0.87              # aanname wisselkoers
# variabele kosten per verkoop (excl. btw), typisch vs maximaal gebruik
PAY = 1.5/100*PRICE_INCL + 0.25   # Stripe EEA-kaart (Bancontact = 0.35, dus dit is worst case)
TRANSCRIBE_MIN_TYP, TRANSCRIBE_MIN_MAX = 60, 300
TRANSCRIBE_USD_PER_MIN = 0.006    # gpt-4o-transcribe
LLM_TYP, LLM_MAX = 0.10, 0.40     # schatting herschrijven 20 hoofdstukken
STORAGE = 0.05                    # per klant, binnen inbegrepen quota
SUPPORT_MIN = 20                  # minuten eigen tijd per klant (hypothese)
FIXED = 45 + 2                    # hosting/db (~€45, te verifiëren) + domein
OWNER_HOURS_FIXED = 4*4.33        # 4 u/week onderhoud+marketing na bouw

net = PRICE_INCL/(1+VAT); vat = PRICE_INCL-net
def var(maxuse=False):
    m = TRANSCRIBE_MIN_MAX if maxuse else TRANSCRIBE_MIN_TYP
    return PAY + m*TRANSCRIBE_USD_PER_MIN*USD_EUR + (LLM_MAX if maxuse else LLM_TYP) + STORAGE
print(f"Prijs incl {PRICE_INCL:.2f} | btw {vat:.2f} | netto {net:.2f}")
print(f"Variabel typisch {var():.2f} | maximaal {var(True):.2f} | betaalkost {PAY:.2f}")
for refund in (0.05, 0.15):
    contrib = net*(1-refund) - var() - refund*0  # terugbetaling: netto weg, betaalkost niet terug
    print(f"\nRefund {refund:.0%}: contributie/verkoop vóór ads = {contrib:.2f}")
    for N in (10,30,100):
        for cac in (0,10,20):
            res = N*(contrib-cac) - FIXED
            hrs = OWNER_HOURS_FIXED + N*SUPPORT_MIN/60
            print(f"  N={N:>3} CAC={cac:>2}: omzet excl btw {N*net:>7.0f} | resultaat {res:>7.0f} | uren {hrs:>4.0f} | €/u {res/hrs:>5.1f}")
    for cac in (0,10,20):
        print(f"  break-even €1.000 bij CAC {cac}: {(1000+FIXED)/(contrib-cac):.0f} verkopen/maand")
print(f"\n€10.000 omzet excl btw: {10000/net:.0f} verkopen/maand")
