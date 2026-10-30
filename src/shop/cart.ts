import type { CartLine, Product } from "./types";
import { receiptTotal } from "./sales";

/**
 * Receipt cart — PURE scan→cart rules used by the POS screen.
 * Scanning a barcode adds qty 1, or increments an existing line.
 * The stock limit is enforced here (UI) AND again inside the save transaction (service).
 */
export interface AddResult {
  cart: CartLine[];
  /** Error code when the scan cannot be added ("out_of_stock" / product row itself when found). */
  error?: "out_of_stock";
  /** Set when the scan incremented an existing line instead of appending. */
  incremented?: boolean;
}

export function addToCart(cart: CartLine[], product: Product, onHand: number): AddResult {
  const existing = cart.find((l) => l.productId === product.id);
  const currentQty = existing?.qty ?? 0;
  if (currentQty + 1 > onHand) {
    return { cart, error: "out_of_stock" };
  }
  if (existing) {
    return {
      cart: cart.map((l) => (l.productId === product.id ? { ...l, qty: l.qty + 1 } : l)),
      incremented: true,
    };
  }
  return {
    cart: [
      ...cart,
      { productId: product.id, barcode: product.barcode, name: product.name, pricePiastres: product.pricePiastres, qty: 1 },
    ],
  };
}

/** Set an explicit qty (0 removes the line). Clamped to available stock. */
export function setLineQty(cart: CartLine[], productId: string, qty: number, onHand: number): CartLine[] {
  if (qty <= 0) return cart.filter((l) => l.productId !== productId);
  const clamped = Math.min(qty, onHand);
  return cart.map((l) => (l.productId === productId ? { ...l, qty: clamped } : l));
}

export function removeLine(cart: CartLine[], productId: string): CartLine[] {
  return cart.filter((l) => l.productId !== productId);
}

export function cartCount(cart: CartLine[]): number {
  return cart.reduce((sum, l) => sum + l.qty, 0);
}

/** Receipt total from cart lines (pure — same formula the accounting side uses for money). */
export function cartTotal(cart: CartLine[]): number {
  return receiptTotal(cart);
}

/**
 * Can this cart be saved given current stock?
 * Returns the first offending line (product id) or null when valid.
 */
export function cartStockConflict(
  cart: CartLine[],
  stockOf: (productId: string) => number,
): { productId: string; requested: number; available: number } | null {
  for (const l of cart) {
    const available = stockOf(l.productId);
    if (l.qty > available) return { productId: l.productId, requested: l.qty, available };
  }
  return null;
}
