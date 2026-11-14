import { describe, expect, it } from "vitest";
import { parseBackup } from "./backupService";

const emptyData = {
  accounts: [],
  operations: [],
  products: [],
  receipts: [],
  returns: [],
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
        stockMoves: [{
          id: "move-1",
          productId: "product-1",
          type: "in",
          qty: 3,
          supplierName: "المورد الأول",
          createdAtIso: "2026-11-10T00:00:00.000Z",
        }],
        shopAssets: [{
          id: "asset-1",
          name: "طابعة",
          pricePiastres: 50000,
          createdAtIso: "2026-11-10T00:00:00.000Z",
        }],
      },
    }));

    expect(backup.data.shopAssets[0]?.owner).toBe("fouad");
    expect(backup.data.stockMoves[0]?.supplierName).toBe("المورد الأول");
  });

  it("accepts return records and defaults returns in an older backup to an empty list", () => {
    const legacy = { ...emptyData };
    delete (legacy as Partial<typeof emptyData>).returns;
    const olderBackup = parseBackup(JSON.stringify({
      format: "basata-tech-backup",
      version: 1,
      createdAtIso: "2026-11-10T00:00:00.000Z",
      data: legacy,
    }));
    expect(olderBackup.data.returns).toEqual([]);

    const backup = parseBackup(JSON.stringify({
      format: "basata-tech-backup",
      version: 1,
      createdAtIso: "2026-11-10T00:00:00.000Z",
      data: {
        ...emptyData,
        returns: [{
          id: "return-1",
          number: 1,
          lines: [{
            productId: "product-1",
            barcode: "123",
            name: "منتج",
            pricePiastres: 2500,
            costPiastres: 1500,
            qty: 1,
          }],
          totalPiastres: 2500,
          paymentMethod: "cash",
          createdAtIso: "2026-11-10T00:00:00.000Z",
        }],
        stockMoves: [{
          id: "move-return",
          productId: "product-1",
          type: "return",
          qty: 1,
          refReturnId: "return-1",
          createdAtIso: "2026-11-10T00:00:00.000Z",
        }],
        settings: [{ key: "returnSeq", value: "1" }],
      },
    }));
    expect(backup.data.returns[0]?.totalPiastres).toBe(2500);
    expect(backup.data.stockMoves[0]?.refReturnId).toBe("return-1");
    expect(backup.data.settings[0]?.key).toBe("returnSeq");
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
