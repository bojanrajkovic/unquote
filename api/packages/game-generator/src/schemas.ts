import { Type, type Static } from "@sinclair/typebox";

export const QuoteSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    text: Type.String({ minLength: 1 }),
    author: Type.String({ minLength: 1 }),
    category: Type.String({ minLength: 1 }),
    difficulty: Type.Number({ minimum: 0, maximum: 100 }),
  },
  { additionalProperties: false },
);

export type Quote = Static<typeof QuoteSchema>;
