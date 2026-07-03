# DAIS

> **Defective Android Interrogation Station**  
> 브라우저에서 온디바이스 AI 안드로이드를 심문하고, 대화의 모순을 찾아 직접 디버깅하는 인터랙티브 게임입니다.

## 프로젝트 개요

DAIS에서 플레이어는 검사관이 되어 안드로이드와 대화하고, 발화 속 모순을 드래그한 뒤 논리적인 반박문을 입력해 정상 또는 불량 판정을 내립니다.

핵심 추론은 WebGPU와 WebLLM을 사용해 로컬 기기에서 처리합니다. 게임 진행 데이터는 IndexedDB에 우선 저장하므로 핵심 플레이는 오프라인에서도 동작하도록 설계합니다. 전체 제품·아키텍처 명세는 [`DAIS.txt`](./DAIS.txt)를 참고하세요.

## 현재 구현 상태

현재 **Milestone 5 — 결정론적 타이핑 유효성 검증기 및 실시간 과열 엔진**까지 구현했습니다.

| 마일스톤 | 구현 내용 | 상태 |
| --- | --- | --- |
| 1 | GMS, ITSS, APS 상태 머신과 경계 조건 | 완료 |
| 2 | 구조화된 캐릭터 프롬프트, GM 멀티 페르소나 마크업 파서 | 완료 |
| 3 | 단기 롤링 버퍼, 중기 Ollama 요약, 장기 앵커와 토큰 예산 | 완료 |
| 4 | NPC 말풍선 DOM 선택 캡처, 오프셋 산출, 모순 부분 문자열 매칭 | 완료 |
| 5 | 반박문 결정론적 검증, APS 기반 실시간 과열 가감산 | 완료 |

### Milestone 5 핵심 동작

- 반박문 앞뒤 공백 제거 후 10자 이상 100자 이하인지 검사
- 정규식 기반 자음 도배·비속어·어뷰징 패턴 차단
- 입력문과 필수 키워드의 모든 공백을 제거해 키워드 매칭
- 최소 키워드 수를 충족한 경우에만 성공 결과 반환
- APS 상태별 과열 배율 적용: `STABLE 1.0`, `SUSPICIOUS 1.2`, `UNSTABLE 1.5`, `OVERCLOCKED 2.0`
- NPC 스트리밍 중 초당 `+1.0%` 추가 가속
- 이벤트 증감 적용: 잘못된 질문 `+5%`, 드래그 실패 `+8%`, 디버깅 실패 `+15%`, 성공 `-30%`
- 모든 게이지 연산을 `0~100`으로 제한하고 외부 반환값은 소수점 넷째 자리까지 정리
- 종료 상태인 `DEACTIVATED`, `CALIBRATED`에서는 패시브 누적 정지
- 음수 시간이나 `NaN`, 무한대 등 비정상 물리 입력 거부

전체 테스트 **56개**, ESLint, 프로덕션 빌드를 품질 기준으로 사용합니다.

## 기술 구성

| 영역 | 기술 |
| --- | --- |
| 언어 | TypeScript |
| 개발 서버·번들러 | Vite |
| 온디바이스 추론 | WebGPU, `@mlc-ai/web-llm` |
| 로컬 추론 연동 | Ollama `/api/generate` |
| 로컬 저장소 | IndexedDB |
| 테스트 | Vitest, jsdom, fake-indexeddb |
| 코드 품질 | ESLint, Prettier |

## 디렉터리 구조

```text
src/
├── core/
│   ├── fsm/              # GMS, ITSS, APS 상태 머신
│   ├── memory/           # 토큰 추산 및 3단계 기억 파이프라인
│   ├── parser/           # 모순 드래그 매칭과 판정
│   ├── prompt/           # 프롬프트 컴파일러와 스트리밍 태그 파서
│   └── validator/        # 타이핑 검증기와 실시간 과열 엔진
├── infrastructure/
│   ├── dom/              # Selection API 기반 선택 캡처
│   ├── ollama/           # 비스트리밍 기억 요약 클라이언트
│   └── ollamaClient.ts   # Ollama NDJSON 스트리밍 클라이언트
├── mocks/                # 브라우저·온디바이스 API 테스트 모의 객체
├── types/                # 프로젝트 전반의 정적 타입 계약
└── view/                 # DOM 렌더링과 사용자 인터랙션

tests/
├── core/                 # FSM, 프롬프트, 기억, 파서, 검증기 테스트
├── infrastructure/       # DOM 선택과 Ollama 클라이언트 테스트
└── smoke.spec.ts
```

의존 방향은 `View → Core ← Infrastructure`를 유지합니다. Core 계층은 DOM이나 WebGPU 구현체 대신 타입 계약에 의존합니다.

## 시작하기

### 요구 사항

- Node.js 20 이상
- WebGPU를 지원하는 최신 Chromium 계열 브라우저
- 기억 요약 연동 시 Ollama와 `gemma-4-e2b` 모델

### 설치 및 실행

```bash
npm install
npm run dev
```

### 검증 명령

```bash
npm test
npm run test:coverage
npm run lint
npm run build
```

Windows PowerShell 실행 정책이 `npm.ps1`을 차단하는 환경에서는 `npm.cmd`를 사용하면 됩니다.

## 환경 변수

개발 및 프로덕션별 공개 엔드포인트는 `.env.development`, `.env.production`에서 설정합니다.

```dotenv
VITE_FALLBACK_API_URL=
VITE_TELEMETRY_ENDPOINT=
```

비밀 키나 서버 전용 값을 `VITE_` 변수에 저장하지 마세요. 개인별 값은 Git에서 제외되는 `.env.local` 또는 `.env.[mode].local`을 사용합니다.

## 개인정보 원칙

대화와 플레이 기록은 로컬 저장이 기본입니다. 외부 전송 기능은 사용자 동의를 전제로 하며, 전화번호·이메일·주민등록번호 등 개인 식별 정보는 기기에서 먼저 마스킹한 익명 데이터만 큐에 적재하는 방향으로 구현합니다.

## 다음 단계

1. DPO 데이터 포맷팅, PII 비식별화, 오프라인 전송 큐
2. 캐릭터 팩과 모딩 규격
3. MVP 통합 검증과 시나리오 QA

## 라이선스

라이선스는 아직 정해지지 않았습니다. 별도 라이선스가 추가되기 전까지 코드의 무단 사용 및 재배포는 허용하지 않습니다.
