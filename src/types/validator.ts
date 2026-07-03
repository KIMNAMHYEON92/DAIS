export interface ValidationRules {
  requiredKeywords: string[];
  minimumKeywordMatchCount: number;
  forbiddenPatterns: string[];
}

export type ValidationErrorCode =
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'FORBIDDEN_PATTERN'
  | 'INSUFFICIENT_KEYWORDS'
  | 'NONE';

export interface ValidationResult {
  isValid: boolean;
  errorCode: ValidationErrorCode;
  errorMessage: string;
  matchedKeywords: string[];
  matchCount: number;
}

export interface OverclockConfig {
  basePassiveRate: number;
  streamingAccelerationRate: number;
}
