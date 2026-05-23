const VERIFICATION_NUMBER = 11;
const FIRST_DIGIT_INITIAL_WEIGHT = 10;
const SECOND_DIGIT_INITIAL_WEIGHT = 11;
const VALIDATION_FACTOR_SPECIAL_CASES = [10, 11];

const CNPJ_INITIAL_WEIGHT = 2;
const CNPJ_WEIGHT_LIMIT = 10;
const CNPJ_VALIDATION_FACTOR_SPECIAL_CASES = [0, 1];

export class Document {
  private document: string;

  constructor(document: string) {
    this.document = document;
  }

  private getCPFVerificationDigit(summatory: number) {
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

  private getCNPJVerificationDigit(summatory: number) {
    const factor = summatory % VERIFICATION_NUMBER;

    if (
      factor === CNPJ_VALIDATION_FACTOR_SPECIAL_CASES[0] ||
      factor === CNPJ_VALIDATION_FACTOR_SPECIAL_CASES[1]
    ) {
      return 0;
    }
    return VERIFICATION_NUMBER - factor;
  }

  isValid() {
    if (typeof this.document !== "string") {
      return false;
    }

    if (
      (this.document.length !== 11 && this.document.length !== 14) ||
      Number.isNaN(Number(this.document))
    ) {
      return false;
    }

    const allDigitsAreIdentical = this.document.split("").every((digit) => digit === this.document[0]);

    if (allDigitsAreIdentical) {
      return false;
    }

    try {
      // Validating if it's an actual CPF
      if (this.document.length === 11) {
        const regularDigits = this.document.slice(0, 9);
        const verificationDigits = this.document.slice(9);

        // Validating the first verification digit
        const firstSummatory = regularDigits
          .split("")
          .reduce(
            (acc: number, digit, index) =>
              acc + (FIRST_DIGIT_INITIAL_WEIGHT - index) * Number(digit),
            0
          );
        const firstVerificationDigit =
          this.getCPFVerificationDigit(firstSummatory);

        if (String(firstVerificationDigit) !== verificationDigits[0]) {
          return false;
        }

        // Validating the second verification digit
        const secondSummatory = `${regularDigits}${verificationDigits[0]}`
          .split("")
          .reduce(
            (acc: number, digit, index) =>
              acc + (SECOND_DIGIT_INITIAL_WEIGHT - index) * Number(digit),
            0
          );
        const secondVerificationDigit =
          this.getCPFVerificationDigit(secondSummatory);

        if (String(secondVerificationDigit) !== verificationDigits[1]) {
          return false;
        }
      }

      // Validating if it's an actual CNPJ
      if (this.document.length === 14) {
        const regularDigits = this.document.slice(0, 12);
        const verificationDigits = this.document.slice(12);

        // Validating the first verification digit
        let firstWeight = CNPJ_INITIAL_WEIGHT;
        const firstSummatory = regularDigits
          .split("")
          .reverse()
          .reduce((acc, digit, index) => {
            if (index === 0) {
              return acc + firstWeight * Number(digit);
            }

            firstWeight += 1;
            if (firstWeight >= CNPJ_WEIGHT_LIMIT) {
              firstWeight = CNPJ_INITIAL_WEIGHT;
            }

            return acc + firstWeight * Number(digit);
          }, 0);
        const firstVerificationDigit =
          this.getCNPJVerificationDigit(firstSummatory);

        if (String(firstVerificationDigit) !== verificationDigits[0]) {
          return false;
        }

        // Validating the first verification digit
        let secondWeight = CNPJ_INITIAL_WEIGHT;
        const secondSummatory = `${regularDigits}${verificationDigits[0]}`
          .split("")
          .reverse()
          .reduce((acc, digit, index) => {
            if (index === 0) {
              return acc + secondWeight * Number(digit);
            }

            secondWeight += 1;
            if (secondWeight >= CNPJ_WEIGHT_LIMIT) {
              secondWeight = CNPJ_INITIAL_WEIGHT;
            }

            return acc + secondWeight * Number(digit);
          }, 0);
        const secondVerificationDigit =
          this.getCNPJVerificationDigit(secondSummatory);

        if (String(secondVerificationDigit) !== verificationDigits[1]) {
          return false;
        }
      }
    } catch (error) {
      throw new Error("Document validation failed");
    }

    return true;
  }
}


export function validateDocument(document: string): boolean {
  const doc = new Document(document);
  return doc.isValid();
}
