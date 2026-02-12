import type { KeywordSource } from "@unquote/game-generator";
import { KEYWORDS } from "@unquote/game-generator";

/**
 * KeywordSource backed by the hardcoded KEYWORDS constant.
 * Wraps the static keyword list from game-generator for DI injection.
 */
export class StaticKeywordSource implements KeywordSource {
  async getKeywords(): Promise<readonly string[]> {
    return KEYWORDS;
  }
}
