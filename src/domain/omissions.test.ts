import { describe, expect, it } from "vitest";
import { deduplicateOmissions } from "./omissions";

describe("deduplicateOmissions", () => {
  it("combines differently worded warnings for the same printing and finish", () => {
    const omissions = deduplicateOmissions([
      { code: "missing-surge-price", message: "Path of Ancestry is omitted.", material: true, dedupeKey: "price:TMC|70|surge" },
      { code: "missing-surge-price", message: "Path of Ancestry is modeled as $0.00.", material: true, dedupeKey: "price:TMC|70|surge" },
    ]);

    expect(omissions).toHaveLength(1);
    expect(omissions[0]?.message).toBe("Path of Ancestry is omitted.");
  });

  it("keeps separate finishes of the same printing", () => {
    const omissions = deduplicateOmissions([
      { code: "missing-foil-price", message: "Foil is missing.", material: true, dedupeKey: "price:TMC|70|foil" },
      { code: "missing-surge-price", message: "Surge foil is missing.", material: true, dedupeKey: "price:TMC|70|surge" },
    ]);

    expect(omissions).toHaveLength(2);
  });
});
