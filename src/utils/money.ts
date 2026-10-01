/** Integer piastres: 1 EGP = 100 piastres. All money in the app is stored this way. */
export type Piastres = number;

export const PIASTRES_PER_EGP = 100;

export function egpToPiastres(amountEgp: number): Piastres {
  if (!Number.isFinite(amountEgp)) throw new Error("invalid_amount");
  return Math.round(amountEgp * PIASTRES_PER_EGP);
}

export function piastresToEgp(piastres: Piastres): number {
  return piastres / PIASTRES_PER_EGP;
}

export function isPiastres(value: unknown): value is Piastres {
  return typeof value === "number" && Number.isInteger(value);
}
