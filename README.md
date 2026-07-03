# DAIS

> **Defective Android Interrogation Station**  
> 브라우저 안에서 온디바이스 AI 안드로이드를 심문하고, 대화의 모순을 찾아 디버깅하는 인터랙티브 게임입니다.

## 프로젝트 개요

DAIS는 플레이어가 심문관이 되어 다양한 안드로이드와 대화하고, 발화 속 모순을 드래그해 교정하며 최종적으로
정상 또는 불량 판정을 내리는 웹 기반 게임입니다.

핵심 추론은 WebGPU와 WebLLM을 통해 사용자 기기에서 수행하는 것을 원칙으로 합니다. 게임 진행 데이터는
IndexedDB에 우선 저장하며, 네트워크와 외부 서버 없이도 핵심 플레이가 가능하도록 설계합니다.

## 핵심 경험

- **온디바이스 AI 심문**: 캐릭터별 페르소나와 기억을 로컬 경량 LLM에 주입
- **모순 디버깅**: NPC 발화에서 잘못된 문장을 드래그하고 반박문을 입력
- **과열 압박**: 대화가 길어질수록 상승하는 Overclock Gauge와 UI 하이재킹
- **상태 기반 서사**: 심문 결과와 동기화율에 따라 변화하는 안드로이드의 감정과 기억
- **로컬 우선 저장**: IndexedDB 기반 세이브와 오프라인 텔레메트리 큐
- **프라이버시 보호**: 명시적 동의와 PII 마스킹을 거친 DPO 학습 데이터만 전송

## 현재 상태

현재 **Milestone 2 — 구조화된 프롬프트 컴파일러 및 멀티 캐릭터 마스킹**까지 구축되어 있습니다.

- GMS(Global Game Manager State) 기반 최상위 씬 전이 및 결과 정산
- ITSS(Interrogation Turn Session State) 기반 심문 턴, 드래그 잠금, 타임아웃 제어
- APS(Android Persona State) 기반 과열 게이지 임계값과 페르소나 연출 메타데이터
- UI와 외부 API에 의존하지 않는 공유 `GameSessionContext` 및 타입 안전 이벤트 계약
- 로컬 Ollama `/api/generate` NDJSON 스트리밍 어댑터
- JSON 캐릭터 팩을 Gemma용 역할극 시스템 프롬프트로 변환하는 `PromptCompiler`
- 단일 모델이 안드로이드와 시스템 콘솔을 함께 연기하도록 제한하는 GM 마스킹 프로토콜
- 토큰 경계에서 분할된 `<agent>` 태그와 미완성 응답을 처리하는 `StreamingMarkupParser`
- 분할 스트림 재조립, 비정상 전이, 타이머·태그 경계 조건을 포함한 단위 테스트
- WebGPU, IndexedDB, DOM Selection 테스트 모킹 및 개발 환경 smoke test
- 엄격한 TypeScript, ESLint, Prettier 규칙과 COOP/COEP 개발 서버 헤더

Milestone 2 검증 기준으로 프로덕션 빌드와 전체 24개 테스트가 통과합니다.

세부 게임 설계는 [`DAIS.txt`](./DAIS.txt)를 참고하세요.

## 기술 구성

| 영역 | 기술 |
| --- | --- |
| 언어 | TypeScript |
| 개발 서버·번들러 | Vite |
| 온디바이스 추론 | WebGPU, `@mlc-ai/web-llm` |
| 로컬 추론 어댑터 | Ollama `/api/generate` 스트리밍 |
| 로컬 저장소 | IndexedDB |
| 테스트 | Vitest, jsdom, fake-indexeddb |
| 품질 관리 | ESLint, Prettier |

## 디렉터리 구조

```text
src/
├── core/
│   ├── fsm/            # GMS, ITSS, APS 독립 상태 머신
│   └── prompt/         # 캐릭터 프롬프트 컴파일러와 스트리밍 태그 파서
├── infrastructure/
│   └── ollamaClient.ts # 로컬 Ollama NDJSON 스트리밍 어댑터
├── mocks/            # 테스트용 브라우저·온디바이스 API 모킹
├── types/            # 마일스톤 전반에서 공유하는 정적 계약
└── view/             # DOM 렌더링과 사용자 인터랙션

tests/
├── core/             # FSM과 프롬프트 컴파일·스트리밍 파서 테스트
├── infrastructure/   # Ollama 스트리밍 및 오류 처리 테스트
└── smoke.spec.ts
```

의존 방향은 `View → Core ← Infrastructure`를 유지합니다. Core 계층은 DOM, WebGPU 구현체 또는 원격 서비스에
직접 의존하지 않습니다.

## Milestone 1–2 코어 구성

| 모듈 | 책임 |
| --- | --- |
| `GlobalStateMachine` | 씬 전이 검증, 심문 컨텍스트 초기화, 성공·과열 결과 정산 |
| `InterrogationStateMachine` | 한 턴의 대화 흐름, 스트리밍 드래그 잠금, 세션·교정·패닉 타이머 |
| `AndroidPersonaStateMachine` | Overclock Gauge 기반 상태 평가와 연출 메타데이터 제공 |
| `OllamaLocalClient` | `localhost:11434`의 생성 스트림을 토큰 콜백으로 변환 |
| `PromptCompiler` | `CharacterPack`을 구조화된 JSON 메타데이터와 역할극·GM 프로토콜로 컴파일 |
| `StreamingMarkupParser` | `<agent id="...">` 스트림을 에이전트별 누적 스냅샷으로 파싱하고 비정형 출력을 격리 |

상태 머신은 `GameSessionContext`를 통해 필요한 세션 수치만 공유합니다. UI는 각 FSM의 `getState()`와 GMS가
제공하는 읽기 전용 컨텍스트를 관찰하고, 명시적인 이벤트로만 전이를 요청하는 방식으로 연결합니다.

프롬프트 계층은 캐릭터의 정적 타입 계약을 snake_case JSON으로 직렬화해 역할극 지침과 결합합니다. GM 출력은
에이전트 태그 단위로 분류하며, 파서는 태그가 임의의 토큰 경계에서 잘리거나 스트림이 비정상 종료되는 경우에도
렌더링 가능한 세그먼트로 복구합니다.

## 시작하기

### 요구 사항

- Node.js 20 이상
- WebGPU를 지원하는 최신 Chromium 계열 브라우저 권장

### 설치 및 실행

```bash
npm install
npm run dev
```

Vite가 출력한 로컬 주소를 브라우저에서 열면 개발 샌드박스의 WebGPU 및 IndexedDB 상태를 확인할 수 있습니다.

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

`VITE_` 접두사가 붙은 값은 클라이언트 번들에 노출됩니다. 비밀키나 서비스 역할 키를 저장하지 마세요.
개인별 값은 Git에서 제외되는 `.env.local` 또는 `.env.[mode].local`에 둡니다.

## 프라이버시 원칙

대화와 플레이 기록은 로컬 저장이 기본입니다. 외부 전송 기능은 사용자 동의를 전제로 하며, 전화번호·이메일·
주민등록번호 등 개인 식별 정보는 기기에서 마스킹한 뒤 익명화된 데이터만 큐에 적재하는 방향으로 구현합니다.

## 로드맵

1. **완료 — 시스템 상태 머신과 코어 게임 루프**
2. **완료 — 구조화된 캐릭터 프롬프트 및 멀티 캐릭터 마스킹**
3. 예정 — 3단계 기억 시스템과 모순 선택·교정
4. 예정 — DPO 데이터 비식별화 및 동기화
5. 예정 — 캐릭터 팩·모딩 규격
6. 예정 — MVP 검증 및 QA

## 라이선스

라이선스는 아직 정해지지 않았습니다. 별도 라이선스가 추가되기 전까지 코드와 자산의 무단 사용 및 재배포는
허용되지 않습니다.
