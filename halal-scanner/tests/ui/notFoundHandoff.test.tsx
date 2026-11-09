// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProductScreen } from "@/components/product/ProductScreen";
import { ApiClientError } from "@/lib/client/apiClient";
import type * as ApiClientModule from "@/lib/client/apiClient";

/**
 * Een onbekend product mag geen doodlopende weg zijn.
 *
 * De ingrediëntenlijst staat op de verpakking, ook als de barcode nergens in
 * staat. Deze test legt vast dat de doorstap naar /scan/ingredients bestaat en
 * niet per ongeluk sneuvelt bij een herindeling van het foutscherm.
 */

const lookupBarcode = vi.fn();

vi.mock("@/lib/client/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return { ...actual, lookupBarcode: (...args: unknown[]) => lookupBarcode(...args) };
});

// Blokvorm, geen expressie: een teruggegeven functie zou Vitest als
// teardown-callback opvatten en de mock na elke test aanroepen.
beforeEach(() => {
  lookupBarcode.mockReset();
});
afterEach(cleanup);

describe("productpagina, product niet gevonden", () => {
  it("wijst door naar de ingrediëntenscanner", async () => {
    lookupBarcode.mockImplementation(() =>
      Promise.reject(
        new ApiClientError("PRODUCT_NOT_FOUND", "NOT_FOUND", "Dit product staat niet in de database.", "req-1"),
      ),
    );

    render(<ProductScreen barcode="5411234567890" />);

    expect(await screen.findByRole("heading", { name: /product niet gevonden/i })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /ingrediënten scannen/i });
    expect(link).toHaveAttribute("href", "/scan/ingredients");
    // De scanner blijft bereikbaar als tweede keuze.
    expect(screen.getByRole("link", { name: /naar de scanner/i })).toHaveAttribute("href", "/scan");
  });

  it("biedt die doorstap niet aan bij een gewone ophaalfout", async () => {
    // Bij een netwerk- of serverfout weten we niet of het product bestaat;
    // dan is "scan de ingrediënten" verkeerd advies.
    lookupBarcode.mockImplementation(() =>
      Promise.reject(
        new ApiClientError("UNKNOWN", "INTERNAL_ERROR", "Er ging iets mis bij het ophalen.", "req-2"),
      ),
    );

    render(<ProductScreen barcode="5411234567890" />);

    expect(await screen.findByRole("heading", { name: /ophalen mislukt/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /ingrediënten scannen/i })).not.toBeInTheDocument();
  });
});
