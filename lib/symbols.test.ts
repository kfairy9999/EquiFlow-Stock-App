import { describe, expect, it } from "vitest";
import { searchSymbols } from "./symbols";

describe("searchSymbols", () => {
  it("matches a ticker, a company name, or a sector", () => {
    expect(searchSymbols("aapl").map((entry) => entry.symbol)).toEqual(["AAPL"]);
    expect(searchSymbols("visa").map((entry) => entry.symbol)).toEqual(["V"]);
    expect(searchSymbols("health").map((entry) => entry.symbol)).toContain("JNJ");
  });

  it("returns nothing for a blank query or an unknown name", () => {
    expect(searchSymbols("")).toEqual([]);
    expect(searchSymbols("   ")).toEqual([]);
    expect(searchSymbols("zzzz")).toEqual([]);
  });
});
