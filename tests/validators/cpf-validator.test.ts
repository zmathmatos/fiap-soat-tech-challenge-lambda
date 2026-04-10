import { validateCPF } from "../../src/validators/cpf-validator";

describe("validateCPF", () => {
  it("should validate a correct CPF", () => {
    expect(validateCPF("52998224725")).toBe(true);
  });

  it("should reject an invalid CPF", () => {
    expect(validateCPF("12345678900")).toBe(false);
  });

  it("should reject CPF with wrong length", () => {
    expect(validateCPF("1234567890")).toBe(false);
    expect(validateCPF("123456789012")).toBe(false);
  });

  it("should reject non-numeric CPF", () => {
    expect(validateCPF("abcdefghijk")).toBe(false);
  });

  it("should reject CPF with all identical digits", () => {
    expect(validateCPF("00000000000")).toBe(false);
    expect(validateCPF("11111111111")).toBe(false);
    expect(validateCPF("99999999999")).toBe(false);
  });

  it("should reject non-string input", () => {
    expect(validateCPF(null as any)).toBe(false);
    expect(validateCPF(undefined as any)).toBe(false);
    expect(validateCPF(12345678901 as any)).toBe(false);
  });
});
