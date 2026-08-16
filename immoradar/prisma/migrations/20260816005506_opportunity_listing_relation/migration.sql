-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
