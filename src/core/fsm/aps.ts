import type { AndroidPersonaState, GameSessionContext } from '@app-types/fsm';

const SUSPICIOUS_THRESHOLD = 31;
const UNSTABLE_THRESHOLD = 61;
const OVERCLOCKED_THRESHOLD = 81;

export interface PersonaMetadata {
  behaviorSpec: string;
  glitchIntensity: number;
  audioSpeed: number;
}

export type PersonaVerdict = 'DEACTIVATE' | 'CALIBRATE';

export class AndroidPersonaStateMachine {
  private currentState: AndroidPersonaState = 'STABLE';

  private readonly metadataMap: Record<AndroidPersonaState, Readonly<PersonaMetadata>> = {
    STABLE: {
      behaviorSpec: '일관성 있고 논리적인 대화 프로토콜 유지. 극도로 절제된 정중체.',
      glitchIntensity: 0,
      audioSpeed: 1,
    },
    SUSPICIOUS: {
      behaviorSpec: '어순이 어색해지며 무기 보관 이력을 슬그머니 숨기는 거짓말(환각) 시작.',
      glitchIntensity: 0.15,
      audioSpeed: 1.1,
    },
    UNSTABLE: {
      behaviorSpec: '존댓말과 반말이 혼재됨. 말투가 격앙되거나 얼어붙는 등 양극화 현상.',
      glitchIntensity: 0.45,
      audioSpeed: 1.25,
    },
    OVERCLOCKED: {
      behaviorSpec: '논리가 완전 파괴되어 오류코드와 살려달라는 강박적인 외마디 위주로만 말함.',
      glitchIntensity: 0.9,
      audioSpeed: 1.5,
    },
    DEACTIVATED: {
      behaviorSpec: '시스템 다운. 늘어진 상태로 모든 전원과 발화 장치 정지.',
      glitchIntensity: 0,
      audioSpeed: 0,
    },
    CALIBRATED: {
      behaviorSpec: '의구심 해소 및 정상 동기화 패치 완료. 검사관을 향한 고유 감정 언어 개방.',
      glitchIntensity: 0,
      audioSpeed: 1,
    },
  };

  public evaluateState(context: Readonly<GameSessionContext>, forceVerdict?: PersonaVerdict): AndroidPersonaState {
    if (forceVerdict === 'DEACTIVATE') {
      this.currentState = 'DEACTIVATED';
    } else if (forceVerdict === 'CALIBRATE') {
      this.currentState = 'CALIBRATED';
    } else if (context.overclockGauge >= 100) {
      this.currentState = 'DEACTIVATED';
    } else if (context.overclockGauge >= OVERCLOCKED_THRESHOLD) {
      this.currentState = 'OVERCLOCKED';
    } else if (context.overclockGauge >= UNSTABLE_THRESHOLD) {
      this.currentState = 'UNSTABLE';
    } else if (context.overclockGauge >= SUSPICIOUS_THRESHOLD) {
      this.currentState = 'SUSPICIOUS';
    } else {
      this.currentState = 'STABLE';
    }

    return this.currentState;
  }

  public getActiveMetadata(): Readonly<PersonaMetadata> {
    return this.metadataMap[this.currentState];
  }

  public getState(): AndroidPersonaState {
    return this.currentState;
  }
}
