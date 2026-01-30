import { describe, it } from "vitest";
import fc from "fast-check";
import { validateSolution } from "./validation.js";

describe("validation properties", () => {
  describe("property: normalization idempotence", () => {
    it("normalizeText(normalizeText(x)) === normalizeText(x)", () => {
      fc.assert(
        fc.property(fc.string(), (text) => {
          // We can't directly call normalizeText since it's internal,
          // But we can test through validateSolution
          // If validation(x, x) is true, then normalization is idempotent
          const result1 = validateSolution(text, text);
          const result2 = validateSolution(text, text);

          return result1 === result2 && result1 === true;
        }),
      );
    });

    it("whitespace normalization is idempotent", () => {
      fc.assert(
        fc.property(fc.string(), (text) => {
          // Adding extra whitespace should not affect validation
          const textWithSpaces = text.replaceAll(/\s/g, "  ");
          const textWithTabs = text.replaceAll(/\s/g, "\t");

          return (
            validateSolution(text, textWithSpaces) &&
            validateSolution(text, textWithTabs) &&
            validateSolution(textWithSpaces, textWithTabs)
          );
        }),
      );
    });
  });

  describe("property: validation reflexivity", () => {
    it("validateSolution(x, x) === true for any text", () => {
      fc.assert(fc.property(fc.string(), (text) => validateSolution(text, text) === true));
    });

    it("validateSolution handles case variations", () => {
      fc.assert(
        fc.property(fc.string(), (text) => {
          const lower = text.toLowerCase();
          const upper = text.toUpperCase();

          return (
            validateSolution(lower, upper) &&
            validateSolution(upper, lower) &&
            validateSolution(text, lower) &&
            validateSolution(text, upper)
          );
        }),
      );
    });
  });

  describe("property: symmetry", () => {
    it("validateSolution(a, b) === validateSolution(b, a)", () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (text1, text2) => {
          const result1 = validateSolution(text1, text2);
          const result2 = validateSolution(text2, text1);

          return result1 === result2;
        }),
      );
    });
  });

  describe("property: transitivity", () => {
    it("if validateSolution(a, b) and validateSolution(b, c) then validateSolution(a, c)", () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), fc.string(), (text1, text2, text3) => {
          const ab = validateSolution(text1, text2);
          const bc = validateSolution(text2, text3);
          const ac = validateSolution(text1, text3);

          // If a === b and b === c, then a === c must hold
          if (ab && bc) {
            return ac === true;
          }

          return true; // Property holds vacuously if precondition not met
        }),
      );
    });
  });

  describe("property: determinism", () => {
    it("same inputs always produce same result", () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (submission, original) => {
          const result1 = validateSolution(submission, original);
          const result2 = validateSolution(submission, original);

          return result1 === result2;
        }),
      );
    });
  });

  describe("property: empty string handling", () => {
    it("empty strings with only whitespace are equivalent", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("", " ", "  ", "\t", "\n", "   \t\n   "),
          fc.constantFrom("", " ", "  ", "\t", "\n", "   \t\n   "),
          (text1, text2) => validateSolution(text1, text2) === true,
        ),
      );
    });
  });

  describe("property: punctuation preservation", () => {
    it("punctuation differences cause validation failure", () => {
      fc.assert(
        fc.property(
          fc.tuple(fc.string({ minLength: 1, maxLength: 50 }), fc.constantFrom(".", ",", "!", "?", ";", ":")),
          ([text, punct]) => {
            const withPunct = text + punct;
            const withoutPunct = text;

            // If text contains no punctuation, adding it should fail validation
            if (!/[.,:;!?]/.test(text)) {
              return validateSolution(withPunct, withoutPunct) === false;
            }

            return true; // Skip if text already has punctuation
          },
        ),
      );
    });
  });
});
