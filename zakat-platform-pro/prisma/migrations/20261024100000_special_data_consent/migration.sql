-- Uitdrukkelijke toestemming (AVG art. 9(2)(a)) bij registratie: Zakat- en
-- Sadaqah-gegevens kunnen de religieuze overtuiging onthullen.
ALTER TABLE "users" ADD COLUMN "specialDataConsentAt" TIMESTAMP(3);
