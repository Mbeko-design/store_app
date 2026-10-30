/**
 * Shop management — PURE domain logic (no I/O, no React).
 * Mirrors src/accounting/: pages call these functions once via hooks
 * and never contain formulas themselves.
 */
export * from "./types";
export * from "./stock";
export * from "./sales";
export * from "./cart";
