# DAIS

> **Defective Android Interrogation Station**  
> 브라우저 안에서 온디바이스 AI 안드로이드를 심문하고, 대화의 모순을 찾아 디버깅하는 인터랙티브 게임입니다.

## 프로젝트 개요

DAIS는 플레이어가 검사관이 되어 안드로이드와 대화하고, 발화 속 모순을 드래그해 교정한 뒤 정상 또는 불량 판정을 내리는 게임입니다.

핵심 추론은 WebGPU와 WebLLM을 이용해 사용자 기기에서 처리합니다. 게임 진행 데이터는 IndexedDB에 우선 저장하여 핵심 플레이가 오프라인에서도 동작하도록 설계합니다. 상세 제품·아키텍처 명세는 [`DAIS.txt`](./DAIS.txt)를 참고하세요.

## 현재 상태

현재 **Milestone 4 — 대화 로그 모순 드래그 선택 및 오프셋 매칭 엔진**까지 구현되었습니다.

- Milestone 1: GMS, ITSS, APS 상태 머신과 코어 게임 루프
- Milestone 2: 구조화된 캐릭터 프롬프트, GM 멀티 페르소나 마스킹, 스트리밍 마크업 파서
- Milestone 3: 단기 롤링 버퍼, 중기 Ollama 요약, 장기 앵커 슬롯, 1,086 토큰 메모리 예산 가드
- Milestone 4: NPC 말풍선 DOM 선택 캡처, 버블 기준 오프셋 산출, 모순 부분 문자열 매칭과 패널티 판정

Milestone 4의 주요 동작은 다음과 같습니다.

- `.npc-bubble[data-dialogue-id]` 내부에서 완료된 유효 텍스트 선택만 캡처
- 중첩 DOM 텍스트 노드에서도 말풍선 전체 텍스트를 기준으로 시작·종료 오프셋 산출
- 공백을 제외한 최소 4글자 이상을 환각 규칙의 `erroneousStatement`와 부분 문자열로 매칭
- 정상 발화, 무관한 구절, 존재하지 않는 대화 ID에는 패널티 여부와 오류 코드를 결정론적으로 반환
- 너무 짧은 선택은 단순 조작 실수로 취급하여 패널티 없이 거절

Milestone 4 완료 기준으로 전체 45개 테스트와 ESLint, 프로덕션 빌드가 통과합니다.

## 기술 구성

| 영역             | 기술                          |
| ---------------- | ----------------------------- |
| 언어             | TypeScript                    |
| 개발 서버·번들러 | Vite                          |
| 온디바이스 추론  | WebGPU, `@mlc-ai/web-llm`     |
| 로컬 추론 연동   | Ollama `/api/generate`        |
| 로컬 저장소      | IndexedDB                     |
| 테스트           | Vitest, jsdom, fake-indexeddb |
| 코드 품질        | ESLint, Prettier              |

## 디렉터리 구조

```text
src/
├── core/
│   ├── fsm/              # GMS, ITSS, APS 상태 머신
│   ├── memory/           # 토큰 추산 및 3단계 기억 파이프라인
│   ├── parser/           # 모순 드래그 매칭과 패널티 판정
│   └── prompt/           # 프롬프트 컴파일러와 스트리밍 태그 파서
├── infrastructure/
│   ├── dom/              # 브라우저 Selection API와 버블 오프셋 캡처
│   ├── ollama/           # 비스트리밍 기억 요약 클라이언트
│   └── ollamaClient.ts   # Ollama NDJSON 스트리밍 클라이언트
├── mocks/                # 브라우저·온디바이스 API 테스트 목
├── types/                # 마일스톤 전반의 정적 타입 계약
└── view/                 # DOM 렌더링과 사용자 인터랙션

tests/
├── core/                 # FSM, 프롬프트, 기억 파이프라인 테스트
├── infrastructure/       # Ollama 스트리밍·요약 클라이언트 테스트
└── smoke.spec.ts
```

의존 방향은 `View → Core ← Infrastructure`를 유지합니다. Core 계층은 DOM이나 WebGPU 구현체가 아닌 인터페이스에 의존합니다.

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

## 환경 변수

개발 및 프로덕션별 공개 엔드포인트는 `.env.development`, `.env.production`에서 설정합니다.

```dotenv
VITE_FALLBACK_API_URL=
VITE_TELEMETRY_ENDPOINT=
```

비밀 키나 서버 전용 값을 `VITE_` 변수에 저장하지 마세요. 개인별 값은 Git에서 제외되는 `.env.local` 또는 `.env.[mode].local`을 사용합니다.

## 개인정보 원칙

대화와 플레이 기록은 로컬 저장이 기본입니다. 외부 전송 기능은 사용자 동의를 전제로 하며, 전화번호·이메일·주민등록번호 등 개인 식별 정보를 기기에서 먼저 마스킹한 익명 데이터만 큐에 적재하는 방향으로 구현합니다.

## 로드맵

1. ✅ 시스템 상태 머신과 코어 게임 루프
2. ✅ 구조화된 캐릭터 프롬프트와 멀티 캐릭터 마스킹
3. ✅ 3단계 기억 관리 파이프라인
4. ✅ 모순 드래그 선택·오프셋 매칭 엔진
5. ⏳ DPO 데이터 비식별화와 동기화
6. ⏳ 캐릭터 팩·모딩 규격
7. ⏳ MVP 검증과 QA

## 라이선스

라이선스는 아직 정해지지 않았습니다. 별도 라이선스가 추가되기 전까지 코드의 무단 사용 및 재배포는 허용되지 않습니다.
