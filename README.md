# DAIS

> **Defective Android Interrogation Station**  
> 브라우저에서 온디바이스 AI 안드로이드를 심문하고, 대화의 모순을 찾아 직접 디버깅하는 인터랙티브 게임입니다.

## 프로젝트 개요

DAIS에서 플레이어는 검사관이 되어 안드로이드와 대화하고, 발화 속 모순을 드래그한 뒤 논리적인 반박문을 입력해 정상 또는 불량 판정을 내립니다.

WebGPU와 WebLLM을 사용해 추론을 로컬 기기에서 처리하며, 게임 진행 데이터는 IndexedDB에 우선 저장합니다. 네트워크가 없어도 플레이할 수 있고, 수집에 동의한 DPO 데이터는 개인정보를 기기에서 비식별화한 다음 온라인 상태에서만 전송합니다. 전체 제품·아키텍처 명세는 [`DAIS.txt`](./DAIS.txt)를 참고하세요.

## 현재 구현 상태

현재 **Milestone 8 — 크라우드 소싱 교차 검수 합의 기구 및 오픈소스 모드 패키저**까지 구현했습니다.

| 마일스톤 | 구현 내용 | 상태 |
| --- | --- | --- |
| 1 | GMS, ITSS, APS 상태 머신과 경계 조건 | 완료 |
| 2 | 구조화된 캐릭터 프롬프트, GM 멀티 페르소나 마크업 파서 | 완료 |
| 3 | 단기 롤링 버퍼, 중기 Ollama 요약, 장기 앵커와 토큰 예산 | 완료 |
| 4 | NPC 말풍선 DOM 선택 캡처, 오프셋 추출, 모순 부분 문자열 매칭 | 완료 |
| 5 | 반박문 결정론적 검증, APS 기반 실시간 과열 가감산 | 완료 |
| 6 | 화면 글리치, 경고 팝업, 마우스 흔들림, 타이핑 문자 유실 | 완료 |
| 7 | IndexedDB 세이브, PII 비식별화, 오프라인 큐 동기화 | 완료 |
| 8 | 5인 교차 검수 합의, 신용 점수 조정, 모드 패키지 규격 검증 | 완료 |

### Milestone 8 핵심 동작

- 5표가 모이면 Pass 4표 이상을 `ACCEPT`, Pass 1표 이하를 `REJECT`, 2~3표를 `PENDING`으로 판정합니다.
- 합의된 골드 데이터 생산자의 신용 점수는 `+10`, 어뷰징 데이터 생산자는 `-50`만큼 조정하며 최종 점수는 `0~1000`으로 제한합니다.
- `character_info.json`의 매니페스트 세대, `AND_` 캐릭터 ID, 표시 이름, 캔버스 배율, `assets/` 기반 Live2D 경로를 검증합니다.
- `memory_anchor.json`의 캐릭터 연결, 해금 배열, `0~100` 동기화율, `ANC_` 앵커 ID와 행동 변경 지시를 검증합니다.

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
│   ├── modding/          # 모드 매니페스트와 메모리 앵커 검증
│   ├── parser/           # 모순 드래그 매칭과 판정
│   ├── prompt/           # 프롬프트 컴파일러와 스트리밍 태그 파서
│   ├── sync/             # PII 비식별화, 텔레메트리 동기화, 합의 엔진
│   └── validator/        # 타이핑 검증기와 실시간 과열 엔진
├── infrastructure/
│   ├── dom/              # Selection API 기반 선택 캡처
│   ├── indexeddb/        # Promise 기반 IndexedDB 관리자
│   └── ollama/           # 비스트리밍 기억 요약 클라이언트
├── mocks/                # 브라우저·온디바이스 API 테스트 모의 객체
├── types/                # 프로젝트 전반의 정적 데이터 계약
└── view/                 # DOM 렌더링과 사용자 인터랙션

tests/
├── core/                 # FSM, 프롬프트, 기억, 파서, 검증, 합의·모딩
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

대화와 플레이 기록은 로컬 저장이 기본입니다. 외부 전송은 사용자 동의를 전제로 하며, 전화번호·이메일·주민등록번호·실명 추정값을 기기에서 먼저 마스킹한 익명 데이터만 저장하고 전송합니다.

## 다음 단계

1. 교차 검수 미니게임 UI와 중앙 검증 풀 API 연결
2. 실제 모드 ZIP 업로드·압축 해제·에셋 존재 여부 검사
3. MVP 통합 검증과 시나리오 QA

## 라이선스

라이선스는 아직 정해지지 않았습니다. 별도 라이선스가 추가되기 전까지 코드의 무단 사용 및 재배포는 허용하지 않습니다.
