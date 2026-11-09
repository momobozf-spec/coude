import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET as listGET } from "@/app/api/marketplace/products/route";
import { GET as detailGET } from "@/app/api/marketplace/products/[id]/route";
import { GET as downloadGET } from "@/app/api/marketplace/download/[purchaseId]/route";
import { GET as fileGET } from "@/app/api/marketplace/file/route";
import { POST as sellerPOST } from "@/app/api/seller/products/route";
import { createDownloadToken, verifyDownloadToken, isAllowedFileUrl } from "@/lib/signed-download";
import { createUser, loginAs, req } from "./helpers";

const SECRET_URL = "https://files.example-storage.test/private/abc123/worksheet.pdf";

let productId = "";
let sellerId = "";

beforeAll(async () => {
  process.env.MARKETPLACE_FILE_HOSTS = "files.example-storage.test";
  const seller = await createUser();
  sellerId = seller.id;
  const p = await prisma.marketplaceProduct.create({
    data: {
      sellerId: seller.id,
      title: "Ramadan pack",
      description: "d",
      price: 4.99,
      category: "ramadan",
      fileUrl: SECRET_URL,
      isApproved: true,
      isPublished: true,
    },
  });
  productId = p.id;
});

afterEach(() => vi.restoreAllMocks());

describe("public marketplace API never exposes fileUrl", () => {
  it("list", async () => {
    const res = await listGET(req("/api/marketplace/products"));
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).toContain("Ramadan pack");
    expect(text).not.toContain("fileUrl");
    expect(text).not.toContain("example-storage");
  });

  it("detail", async () => {
    const res = await detailGET(req(`/api/marketplace/products/${productId}`), { params: Promise.resolve({ id: productId }) });
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toContain("fileUrl");
    expect(text).not.toContain("example-storage");
  });
});

describe("signed download", () => {
  it("token: valid, tampered, expired", () => {
    const t = createDownloadToken({ purchaseId: "p1", userId: "u1" });
    expect(verifyDownloadToken(t)?.purchaseId).toBe("p1");
    const [data, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ purchaseId: "p2", userId: "u1", exp: 9999999999 })).toString("base64url");
    expect(verifyDownloadToken(`${forged}.${sig}`)).toBeNull();
    expect(verifyDownloadToken(`${data}.x${sig.slice(1)}`)).toBeNull();
    const old = createDownloadToken({ purchaseId: "p1", userId: "u1" }, 60, Date.now() - 3600_000);
    expect(verifyDownloadToken(old)).toBeNull();
  });

  it("file URL allow-list blocks SSRF targets", () => {
    expect(isAllowedFileUrl(SECRET_URL)).toBe(true);
    expect(isAllowedFileUrl("http://files.example-storage.test/x.pdf")).toBe(false);
    expect(isAllowedFileUrl("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isAllowedFileUrl("https://user:pw@files.example-storage.test/x")).toBe(false);
  });

  it("seller cannot register a file on a non-allowed host", async () => {
    await prisma.sellerProfile.create({ data: { userId: sellerId, displayName: "S" } });
    loginAs(sellerId);
    const res = await sellerPOST(req("/api/seller/products", { body: { title: "t", description: "d", category: "c", price: 0, fileUrl: "http://localhost:3000/secret" } }));
    expect(res.status).toBe(400);
  });

  it("only the buyer gets a link; limit enforced; file streamed without exposing URL", async () => {
    const buyer = await createUser();
    const other = await createUser();
    const purchase = await prisma.marketplacePurchase.create({
      data: { buyerId: buyer.id, productId, pricePaid: 4.99, sellerAmount: 3.49, noorAmount: 1.5, maxDownloads: 2 },
    });
    const params = { params: Promise.resolve({ purchaseId: purchase.id }) };

    loginAs(null);
    expect((await downloadGET(req("/x"), params)).status).toBe(401);
    loginAs(other.id);
    expect((await downloadGET(req("/x"), params)).status).toBe(404);

    loginAs(buyer.id);
    const r1 = await downloadGET(req("/x"), params);
    expect(r1.status).toBe(200);
    const b1 = await r1.json();
    expect(b1.downloadUrl).toMatch(/^\/api\/marketplace\/file\?token=/);
    expect(JSON.stringify(b1)).not.toContain("example-storage");

    // streaming: upstream fetch is mocked
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("%PDF-1.4 test", { status: 200, headers: { "content-type": "application/pdf" } }));
    const fileRes = await fileGET(req(b1.downloadUrl));
    expect(fileRes.status).toBe(200);
    expect(await fileRes.text()).toBe("%PDF-1.4 test");
    expect(fetchSpy).toHaveBeenCalledWith(SECRET_URL, expect.anything());
    expect(fileRes.headers.get("content-disposition")).toContain("attachment");

    // same token, other user → 403
    loginAs(other.id);
    expect((await fileGET(req(b1.downloadUrl))).status).toBe(403);
    // garbage token → 403
    loginAs(buyer.id);
    expect((await fileGET(req("/api/marketplace/file?token=abc.def"))).status).toBe(403);

    // second download ok, third blocked (maxDownloads = 2)
    expect((await downloadGET(req("/x"), params)).status).toBe(200);
    expect((await downloadGET(req("/x"), params)).status).toBe(403);
    const after = await prisma.marketplacePurchase.findUnique({ where: { id: purchase.id } });
    expect(after?.downloadCount).toBe(2);
  });
});
