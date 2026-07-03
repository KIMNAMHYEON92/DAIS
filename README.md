# DAIS

> **Defective Android Interrogation Station**  
> 브라우저에서 온디바이스 AI 안드로이드를 심문하고, 대화의 모순을 찾아 직접 디버깅하는 인터랙티브 게임입니다.

## 프로젝트 개요

DAIS에서 플레이어는 검사관이 되어 안드로이드와 대화하고, 발화 속 모순을 드래그한 뒤 논리적인 반박문을 입력해 정상 또는 불량 판정을 내립니다.

WebGPU와 WebLLM을 사용해 핵심 추론을 로컬 기기에서 처리하며, 게임 진행 데이터는 IndexedDB에 우선 저장합니다. 네트워크가 끊겨도 플레이할 수 있고, 수집에 동의한 DPO 데이터는 개인정보를 기기에서 비식별화한 뒤 온라인 상태에서만 전송하는 구조입니다. 전체 제품·아키텍처 명세는 [`DAIS.txt`](./DAIS.txt)를 참고하세요.

## 현재 구현 상태

현재 **Milestone 7 — 로컬 세이브 및 개인정보 비식별화 동기화 파이프라인**까지 구현했습니다.

| 마일스톤 | 구현 내용 | 상태 |
| --- | --- | --- |
| 1 | GMS, ITSS, APS 상태 머신과 경계 조건 | 완료 |
| 2 | 구조화된 캐릭터 프롬프트, GM 멀티 페르소나 마크업 파서 | 완료 |
| 3 | 단기 롤링 버퍼, 중기 Ollama 요약, 장기 앵커와 토큰 예산 | 완료 |
| 4 | NPC 말풍선 DOM 선택 캡처, 오프셋 추출, 모순 부분 문자열 매칭 | 완료 |
| 5 | 반박문 결정론적 검증, APS 기반 실시간 과열 가감산 | 완료 |
| 6 | 화면 글리치, 경고 팝업, 마우스 흔들림, 타이핑 문자 유실 | 완료 |
| 7 | IndexedDB 세이브, PII 비식별화, 오프라인 큐와 청크 동기화 | 완료 |

### Milestone 7 핵심 동작

- `tbl_user_profile`, `tbl_character_progress`, `tbl_offline_telemetry_queue` 타입과 IndexedDB 객체 저장소를 정의합니다.
- Promise 기반 CRUD 래퍼가 IndexedDB 트랜잭션 완료 시점까지 쓰기 작업을 보장합니다.
- 주민등록번호, 한국 전화번호, 이메일, 2~4자의 한국어 성명 추정값을 로컬에서 마스킹합니다.
- 아리아·검사관·보관고 등 게임 고유 명사는 화이트리스트로 보존합니다.
- 텔레메트리 저장·전송 경계에서 `chosen`을 다시 비식별화해 원문 PII가 큐나 원격 서버로 나가지 않도록 합니다.
- 온라인 직접 전송 실패 시 데이터가 로컬 큐에 자동 보존됩니다.
- 브라우저 `online` 이벤트가 발생하면 대기 데이터를 최대 5개씩 나누어 모두 전송하고, 성공한 레코드만 로컬에서 삭제합니다.
- 서버 오류나 오프라인 상태에서는 게임 흐름을 막지 않고 큐를 그대로 유지합니다.

현재 자동화 검증 기준은 **73개 테스트**, ESLint, 프로덕션 빌드입니다.

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
│   ├── hijack/           # 글리치, 팝업, 마우스·타이핑 방해
│   ├── memory/           # 토큰 예산 및 3단계 기억 파이프라인
│   ├── parser/           # 모순 드래그 매칭과 판정
│   ├── prompt/           # 프롬프트 컴파일러와 스트리밍 태그 파서
│   ├── sync/             # PII 비식별화와 텔레메트리 동기화
│   └── validator/        # 타이핑 검증기와 실시간 과열 엔진
├── infrastructure/
│   ├── dom/              # Selection API 기반 선택 캡처
│   ├── indexeddb/        # Promise 기반 IndexedDB 관리자
│   ├── ollama/           # 비스트리밍 기억 요약 클라이언트
│   └── ollamaClient.ts   # Ollama NDJSON 스트리밍 클라이언트
├── mocks/                # 브라우저·온디바이스 API 테스트 모의 객체
├── types/                # 프로젝트 전반의 정적 데이터 계약
└── view/                 # DOM 렌더링과 사용자 인터랙션

tests/
├── core/                 # FSM, 프롬프트, 기억, 파서, 검증, 하이재킹, 동기화
├── infrastructure/       # DOM 선택과 Ollama·IndexedDB 연동
└── smoke.spec.ts
```

의존 방향은 `View → Core → Infrastructure`를 유지합니다. Core 계층은 DOM이나 WebGPU 구현체 대신 계약에 의존합니다.

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

대화와 플레이 기록은 로컬 저장이 기본입니다. 외부 전송은 사용자 동의를 전제로 하며, 전화번호·이메일·주민등록번호와 실명 추정값을 기기에서 먼저 마스킹한 익명 데이터만 큐에 저장하고 전송합니다.

## 다음 단계

1. 캐릭터 팩과 모딩 규격 구현
2. 실제 원격 텔레메트리 어댑터 연결과 사용자 동의 흐름
3. MVP 통합 검증과 시나리오 QA

## 라이선스

라이선스는 아직 정해지지 않았습니다. 별도 라이선스가 추가되기 전까지 코드의 무단 사용 및 재배포는 허용되지 않습니다.
