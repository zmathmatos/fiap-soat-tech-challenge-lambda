import { validateDocument } from "../../src/validators/document-validator";

describe("validateDocument", () => {
  it("should validate a correct CPF", () => {
    expect(validateDocument("52998224725")).toBe(true);
  });

  it("should validate a correct CNPJ", () => {
    expect(validateDocument("11222333000181")).toBe(true);
  });

  it("should reject an invalid CPF", () => {
    expect(validateDocument("12345678900")).toBe(false);
  });

  it("should reject CPF with wrong length", () => {
    expect(validateDocument("1234567890")).toBe(false);
    expect(validateDocument("123456789012")).toBe(false);
  });

  it("should reject non-numeric CPF", () => {
    expect(validateDocument("abcdefghijk")).toBe(false);
  });

  it("should reject CPF with all identical digits", () => {
    expect(validateDocument("00000000000")).toBe(false);
    expect(validateDocument("11111111111")).toBe(false);
    expect(validateDocument("99999999999")).toBe(false);
  });

  it("should reject non-string input", () => {
    expect(validateDocument(null as any)).toBe(false);
    expect(validateDocument(undefined as any)).toBe(false);
    expect(validateDocument(12345678901 as any)).toBe(false);
  });
});
