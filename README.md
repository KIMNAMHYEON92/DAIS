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

현재 **Milestone 0 — 기본 개발 환경**까지 구축되어 있습니다.

- Vite + TypeScript 기반 프레임워크 비종속 실행 환경
- Core / Types / Infrastructure / View 계층 분리
- WebGPU, WebLLM, IndexedDB, DOM Selection 테스트 모킹
- Vitest smoke test 및 V8 coverage 설정
- 엄격한 TypeScript, ESLint, Prettier 규칙
- WebGPU 실행에 필요한 COOP/COEP 개발 서버 헤더

세부 게임 설계는 [`DAIS.txt`](./DAIS.txt)를 참고하세요.

## 기술 구성

| 영역 | 기술 |
| --- | --- |
| 언어 | TypeScript |
| 개발 서버·번들러 | Vite |
| 온디바이스 추론 | WebGPU, `@mlc-ai/web-llm` |
| 로컬 저장소 | IndexedDB |
| 테스트 | Vitest, jsdom, fake-indexeddb |
| 품질 관리 | ESLint, Prettier |

## 디렉터리 구조

```text
src/
├── core/             # UI와 외부 엔진에 독립적인 도메인 로직
├── infrastructure/   # IndexedDB, WebGPU, 원격 API 어댑터
├── mocks/            # 테스트용 브라우저·온디바이스 API 모킹
├── types/            # 마일스톤 전반에서 공유하는 정적 계약
└── view/             # DOM 렌더링과 사용자 인터랙션

tests/
├── core/
├── infrastructure/
├── integration/
└── smoke.spec.ts
```

의존 방향은 `View → Core ← Infrastructure`를 유지합니다. Core 계층은 DOM, WebGPU 구현체 또는 원격 서비스에
직접 의존하지 않습니다.

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

1. 시스템 상태 머신과 게임 루프
2. 캐릭터 프롬프트 및 3단계 기억 시스템
3. 모순 선택·교정과 Overclock Gauge
4. DPO 데이터 비식별화 및 동기화
5. 캐릭터 팩·모딩 규격
6. MVP 검증 및 QA

## 라이선스

라이선스는 아직 정해지지 않았습니다. 별도 라이선스가 추가되기 전까지 코드와 자산의 무단 사용 및 재배포는
허용되지 않습니다.
