const VERIFICATION_NUMBER = 11;
const FIRST_DIGIT_INITIAL_WEIGHT = 10;
const SECOND_DIGIT_INITIAL_WEIGHT = 11;
const VALIDATION_FACTOR_SPECIAL_CASES = [10, 11];

function getCPFVerificationDigit(summatory: number): number {
  const factor = summatory % VERIFICATION_NUMBER;
  const verificationDigit = VERIFICATION_NUMBER - factor;

  if (
    verificationDigit === VALIDATION_FACTOR_SPECIAL_CASES[0] ||
    verificationDigit === VALIDATION_FACTOR_SPECIAL_CASES[1]
  ) {
    return 0;
  }

  return verificationDigit;
}

export function validateCPF(cpf: string): boolean {
  if (typeof cpf !== "string") {
    return false;
  }

  if (cpf.length !== 11 || Number.isNaN(Number(cpf))) {
    return false;
  }

  // Reject CPFs with all identical digits
  if (/^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const regularDigits = cpf.slice(0, 9);
  const verificationDigits = cpf.slice(9);

  // Validate first verification digit
  const firstSummatory = regularDigits
    .split("")
    .reduce(
      (acc: number, digit, index) =>
        acc + (FIRST_DIGIT_INITIAL_WEIGHT - index) * Number(digit),
      0
    );
  const firstVerificationDigit = getCPFVerificationDigit(firstSummatory);

  if (String(firstVerificationDigit) !== verificationDigits[0]) {
    return false;
  }

  // Validate second verification digit
  const secondSummatory = `${regularDigits}${verificationDigits[0]}`
    .split("")
    .reduce(
      (acc: number, digit, index) =>
        acc + (SECOND_DIGIT_INITIAL_WEIGHT - index) * Number(digit),
      0
    );
  const secondVerificationDigit = getCPFVerificationDigit(secondSummatory);

  if (String(secondVerificationDigit) !== verificationDigits[1]) {
    return false;
  }

  return true;
}
