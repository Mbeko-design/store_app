import { describe, expect, it } from "vitest";
import { seedAccounts } from "./accounts.js";
import { buildWalletSend } from "./wallet.js";
import { accountToEvent, entryToEvent, validatePushEvent } from "./sync.js";

describe("sync events", () => {
  it("round-trips a journal entry through the wire format", () => {
    const entry = buildWalletSend({ wallet: "vodafone", amount: 50000, fee: 1000, deviceId: "dev-a" });
    const ev = entryToEvent(entry);
    expect(() => validatePushEvent(ev, "dev-a")).not.toThrow();
    expect(ev.uuid).toBe(entry.id);
    expect(ev.kind).toBe("journal_entry");
  });

  it("rejects tampered events", () => {
    const entry = buildWalletSend({ wallet: "vodafone", amount: 50000, fee: 1000, deviceId: "dev-a" });
    const ev = entryToEvent(entry);

    expect(() => validatePushEvent({ ...ev, uuid: "not-a-uuid" }, "dev-a")).toThrow("bad_uuid");
    expect(() => validatePushEvent({ ...ev, kind: "nope" }, "dev-a")).toThrow("bad_kind");
    expect(() => validatePushEvent({ ...ev, deviceId: "dev-b" }, "dev-a")).toThrow("device_mismatch");
    expect(() => validatePushEvent({ ...ev, occurredAt: "yesterday" }, "dev-a")).toThrow("bad_occurred_at");

    // unbalanced payload
    const bad = { ...entry, postings: [{ accountId: "cash_drawer", debit: 999, credit: 0 }, { accountId: "wallet_vodafone", debit: 0, credit: 50000 }] };
    expect(() => validatePushEvent({ ...ev, payload: bad }, "dev-a")).toThrow("unbalanced_entry");
  });

  it("rejects payload whose id differs from the event uuid", () => {
    const entry = buildWalletSend({ wallet: "vodafone", amount: 50000, deviceId: "dev-a" });
    const ev = entryToEvent(entry);
    expect(() => validatePushEvent({ ...ev, uuid: crypto.randomUUID() }, "dev-a")).toThrow("entry_uuid_mismatch");
  });

  it("validates account upsert events", () => {
    const account = seedAccounts()[0]!;
    const ev = accountToEvent(account);
    expect(() => validatePushEvent(ev)).not.toThrow();
    expect(() => validatePushEvent({ ...ev, payload: { ...account, type: "banana" } })).toThrow("bad_account_type");
  });
});
