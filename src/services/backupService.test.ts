import { describe, expect, it } from "vitest";
import { parseBackup } from "./backupService";

const emptyData = {
  accounts: [],
  operations: [],
  products: [],
  receipts: [],
  stockMoves: [],
  shopAssets: [],
  settings: [],
  profile: [],
};

describe("backup validation", () => {
  it("accepts a supported backup and assigns legacy equipment to Fouad", () => {
    const backup = parseBackup(JSON.stringify({
      format: "basata-tech-backup",
      version: 1,
      createdAtIso: "2026-11-10T00:00:00.000Z",
      data: {
        ...emptyData,
        shopAssets: [{
          id: "asset-1",
          name: "طابعة",
          pricePiastres: 50000,
          createdAtIso: "2026-11-10T00:00:00.000Z",
        }],
      },
    }));

    expect(backup.data.shopAssets[0]?.owner).toBe("fouad");
  });

  it("rejects unsupported versions and malformed rows", () => {
    expect(() => parseBackup(JSON.stringify({
      format: "basata-tech-backup",
      version: 99,
      createdAtIso: "2026-11-10T00:00:00.000Z",
      data: emptyData,
    }))).toThrow("unsupported_backup");

    expect(() => parseBackup(JSON.stringify({
      format: "basata-tech-backup",
      version: 1,
      createdAtIso: "2026-11-10T00:00:00.000Z",
      data: { ...emptyData, products: [{ id: "broken" }] },
    }))).toThrow("invalid_backup_data");
  });
});
