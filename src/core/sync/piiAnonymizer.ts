const GAME_NOUNS_WHITELIST = new Set([
  '아리아',
  '검사관',
  '감독관',
  '보관고',
  '무기고',
  '안드로이드',
  '판정소',
  '크레딧',
  '윤활유',
  '점검',
  '코어',
  '오픈',
  '로비',
  '보관',
  '오늘',
  '내일',
  '로그',
  '무기',
  '분실',
  '수리',
  '폐쇄',
  '공장',
  '가동',
  '가동일',
  '침입',
  '탈취',
  '소총',
  '레이저',
  '일정',
  '예약',
  '일지',
  '정상',
  '승인',
  '경고',
  '에러',
  '폭주',
  '분석',
]);

export class PiiAnonymizer {
  private static readonly REGEX_RRN = /\b\d{6}\s*-\s*[1-4]\d{6}\b/g;
  private static readonly REGEX_PHONE = /\b01[016789]\s*-\s*\d{3,4}\s*-\s*\d{4}\b/g;
  private static readonly REGEX_EMAIL = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;

  // JavaScript의 \b는 한글을 단어 문자로 보지 않으므로 한글 경계를 직접 검사한다.
  private static readonly REGEX_KOREAN_NAME = /(?<![가-힣])([가-힣]{2,4})(?![가-힣])/g;

  public static sanitize(text: string): string {
    return text
      .replace(this.REGEX_RRN, '[REDACTED_RRN]')
      .replace(this.REGEX_PHONE, '[REDACTED_PHONE]')
      .replace(this.REGEX_EMAIL, '[REDACTED_EMAIL]')
      .replace(this.REGEX_KOREAN_NAME, (match: string): string =>
        GAME_NOUNS_WHITELIST.has(match) ? match : '[USER_NAME]',
      );
  }
}
