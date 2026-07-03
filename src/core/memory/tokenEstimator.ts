const KOREAN_CHARACTER_TOKEN_WEIGHT = 1.6;
const NON_KOREAN_CHARACTER_TOKEN_WEIGHT = 0.4;

export class TokenEstimator {
  /**
   * 한국어와 영문 결합 구조를 기반으로 토큰 수를 보수적으로 추산한다.
   */
  public static estimate(text: string): number {
    const trimmed = text.trim();

    if (trimmed.length === 0) {
      return 0;
    }

    let tokenCount = 0;
    const words = trimmed.split(/\s+/);

    for (const word of words) {
      const hasKorean = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(word);

      if (hasKorean) {
        tokenCount += Math.ceil(word.length * KOREAN_CHARACTER_TOKEN_WEIGHT);
      } else {
        tokenCount += Math.ceil(word.length * NON_KOREAN_CHARACTER_TOKEN_WEIGHT) + 1;
      }
    }

    return tokenCount;
  }
}
