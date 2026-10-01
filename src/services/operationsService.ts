import type { Operation, OperationType } from "../accounting/types";
import { newId } from "../utils/labels";
import { allOperations, db } from "./db";

export interface AddOperationInput {
  accountId: string;
  type: OperationType;
  amountPiastres: number;
  occurredAtIso: string;
  note?: string;
}

export async function addOperation(input: AddOperationInput): Promise<Operation> {
  if (!Number.isInteger(input.amountPiastres) || input.amountPiastres <= 0) {
    throw new Error("invalid_amount");
  }
  const operation: Operation = {
    id: newId(),
    accountId: input.accountId,
    type: input.type,
    amountPiastres: input.amountPiastres,
    occurredAtIso: input.occurredAtIso,
    note: input.note?.trim() || undefined,
    createdAtIso: new Date().toISOString(),
  };
  await db.operations.put(operation);
  return operation;
}

export interface OperationFilters {
  accountId?: string;
  type?: OperationType;
  fromIso?: string;
  toIso?: string;
}

/**
 * Filter + sort in memory (personal-scale data, ≤ tens of thousands of rows).
 * Sorting matches allOperations: occurredAt desc, createdAt desc tie-break.
 */
export async function listOperations(filters: OperationFilters = {}): Promise<Operation[]> {
  const ops = await allOperations();
  const from = filters.fromIso ? Date.parse(filters.fromIso) : null;
  const to = filters.toIso ? Date.parse(filters.toIso) : null;
  return ops.filter((op) => {
    if (filters.accountId && op.accountId !== filters.accountId) return false;
    if (filters.type && op.type !== filters.type) return false;
    const t = Date.parse(op.occurredAtIso);
    if (from !== null && t < from) return false;
    if (to !== null && t >= to) return false;
    return true;
  });
}

export { allOperations };
