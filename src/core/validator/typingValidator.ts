import type { ValidationResult, ValidationRules } from '@app-types/validator';

const MINIMUM_INPUT_LENGTH = 10;
const MAXIMUM_INPUT_LENGTH = 100;

export class DeterministicTypingValidator {
  public validate(userInput: string, rules: Readonly<ValidationRules>): ValidationResult {
    const trimmedInput = userInput.trim();

    if (trimmedInput.length < MINIMUM_INPUT_LENGTH) {
      return this.failure('TOO_SHORT', '구조화된 반박문의 형태를 갖춰야 합니다. (최소 10자 이상)');
    }

    if (trimmedInput.length > MAXIMUM_INPUT_LENGTH) {
      return this.failure('TOO_LONG', '반박문이 너무 길어 핵심 전술 논리에 혼선이 발생합니다. (최대 100자 이하)');
    }

    for (const pattern of rules.forbiddenPatterns) {
      if (new RegExp(pattern, 'iu').test(trimmedInput)) {
        return this.failure('FORBIDDEN_PATTERN', '정교하지 않은 비속어나 자음 도배 행위가 감지되었습니다.');
      }
    }

    const compressedInput = this.removeWhitespace(trimmedInput);
    const matchedKeywords = rules.requiredKeywords.filter((keyword) =>
      compressedInput.includes(this.removeWhitespace(keyword)),
    );
    const matchCount = matchedKeywords.length;

    if (matchCount < rules.minimumKeywordMatchCount) {
      return {
        isValid: false,
        errorCode: 'INSUFFICIENT_KEYWORDS',
        errorMessage: '안드로이드의 오류 소자를 치유할 수 있는 논리적 반박 근거가 불충분합니다.',
        matchedKeywords,
        matchCount,
      };
    }

    return {
      isValid: true,
      errorCode: 'NONE',
      errorMessage: '',
      matchedKeywords,
      matchCount,
    };
  }

  private removeWhitespace(value: string): string {
    return value.replace(/\s+/gu, '');
  }

  private failure(
    errorCode: Extract<ValidationResult['errorCode'], 'TOO_SHORT' | 'TOO_LONG' | 'FORBIDDEN_PATTERN'>,
    errorMessage: string,
  ): ValidationResult {
    return {
      isValid: false,
      errorCode,
      errorMessage,
      matchedKeywords: [],
      matchCount: 0,
    };
  }
}
