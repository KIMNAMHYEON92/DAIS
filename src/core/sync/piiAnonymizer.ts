export class PiiAnonymizer {
  private static readonly REGEX_RRN = /\b\d{6}\s*-\s*[1-4]\d{6}\b/g;
  private static readonly REGEX_PHONE = /\b01[016789]\s*-\s*\d{3,4}\s*-\s*\d{4}\b/g;
  private static readonly REGEX_EMAIL =
    /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;

  /**
   * A bare 2–4 syllable Korean token is usually an ordinary word, not a name.
   * Name masking is therefore limited to explicit identity contexts so the
   * correction sentence remains useful as DPO training data.
   */
  private static readonly CONTEXTUAL_NAME_PATTERNS: readonly RegExp[] = [
    /(?<=(?:제\s*이름은|내\s*이름은|이름은|저는|본인은)\s*)[가-힣]{2,4}(?=\s*(?:입니다|이라고|이고|이며|,|\.|$))/gu,
    /[가-힣]{2,4}(?=의\s*(?:주민등록번호|주민번호|전화번호|이메일))/gu,
    /[가-힣]{2,4}(?=\s*(?:검사관|사용자|테스터)(?:입니다|의|,|\.|\s|$))/gu,
  ];

  public static sanitize(text: string): string {
    let sanitized = text
      .replace(this.REGEX_RRN, '[REDACTED_RRN]')
      .replace(this.REGEX_PHONE, '[REDACTED_PHONE]')
      .replace(this.REGEX_EMAIL, '[REDACTED_EMAIL]');

    for (const pattern of this.CONTEXTUAL_NAME_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[USER_NAME]');
    }

    return sanitized;
  }
}
