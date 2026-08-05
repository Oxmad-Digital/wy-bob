import { describe, it, expect } from "vitest";
import { formatInvoiceNumber, computeInvoiceAmounts } from "./invoicePricing";

describe("formatInvoiceNumber", () => {
  it("pads the sequence to 4 digits and includes the year", () => {
    expect(formatInvoiceNumber(2026, 1)).toBe("FACT-2026-0001");
    expect(formatInvoiceNumber(2026, 42)).toBe("FACT-2026-0042");
    expect(formatInvoiceNumber(2027, 10000)).toBe("FACT-2027-10000");
  });
});

describe("computeInvoiceAmounts", () => {
  it("derives the pre-discount subtotal from the actually-charged total, not product prices", () => {
    const result = computeInvoiceAmounts({
      totalTtc: 56.8,
      shippingFeeTtc: 6.9,
      promoDiscount: 5,
      vatApplicable: false,
    });
    expect(result.subtotalTtc).toBe(54.9); // 56.8 - 6.9 + 5
    expect(result.totalTtc).toBe(56.8);
  });

  it("shows the full TTC amount as HT with zero VAT when not VAT-registered", () => {
    const result = computeInvoiceAmounts({ totalTtc: 100, vatApplicable: false });
    expect(result.totalHt).toBe(100);
    expect(result.vatAmount).toBe(0);
  });

  it("backs out HT and VAT from a TTC total at the configured rate", () => {
    const result = computeInvoiceAmounts({ totalTtc: 120, vatApplicable: true, vatRate: 20 });
    expect(result.totalHt).toBe(100);
    expect(result.vatAmount).toBe(20);
  });

  it("rounds away floating point drift", () => {
    const result = computeInvoiceAmounts({ totalTtc: 19.99, vatApplicable: true, vatRate: 20 });
    expect(result.totalHt).toBeCloseTo(16.66, 2);
    expect(result.vatAmount).toBeCloseTo(3.33, 2);
    expect(result.totalHt + result.vatAmount).toBeCloseTo(19.99, 2);
  });

  it("defaults missing shipping/discount to zero", () => {
    const result = computeInvoiceAmounts({ totalTtc: 50, vatApplicable: false });
    expect(result.subtotalTtc).toBe(50);
  });
});
