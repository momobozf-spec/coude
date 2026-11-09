import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Heart } from "lucide-react";
import { Link } from "@/i18n/navigation";
import ProductGrid from "@/components/products/ProductGrid";

export default async function WishlistPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/nl/login");
  const user = session.user as { id: string };

  const wishlistItems = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    include: {
      product: {
        include: { category: { select: { id: true, name: true, slug: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const products = wishlistItems.map((w) => w.product);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold tracking-tight font-[family-name:var(--font-heading)] mb-8">Favorieten</h1>

      {products.length === 0 ? (
        <div className="text-center py-20">
          <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg text-muted-foreground mb-4">Geen favorieten opgeslagen</p>
          <Link href="/products" className="text-sm font-medium underline">Ontdek onze collectie</Link>
        </div>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}
