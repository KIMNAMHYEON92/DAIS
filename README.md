# DAIS

> **Defective Android Interrogation Station**  
> 대화 속 모순을 포착하고 안드로이드의 손상된 기억을 직접 디버깅하는 로컬 우선 AI 심문 게임

![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-91%20tests-6E9F18?logo=vitest&logoColor=white)
![MVP](https://img.shields.io/badge/MVP-Playable-74F7CA)

DAIS는 플레이어가 검사관이 되어 안드로이드를 심문하고, 발화 속 모순을 드래그한 뒤 사실 기반 반박문을 입력해 논리 오류를 교정하는 브라우저 게임입니다.

현재 저장소의 기본 진입점은 **처음부터 최종 판정까지 직접 플레이 가능한 MVP 데모**입니다. 별도 AI 모델 없이 실행되는 Demo Core와 로컬 Ollama 우선 모드를 모두 제공하며, Ollama 연결에 실패해도 플레이가 끊기지 않고 자동으로 Demo Core로 전환됩니다.

## 현재 상태

**MVP Milestone 1~10 및 실제 플레이 데모 구현 완료**

| 영역                    | 상태 | 플레이 데모 반영 내용                               |
| ----------------------- | ---- | --------------------------------------------------- |
| Game loop               | 완료 | 로비 → 심문 → 모순 포착 → 교정 → 최종 판정 → 결과   |
| Local inference         | 완료 | 무설치 Demo Core, Ollama `gemma-4-e2b`, 자동 폴백   |
| FSM                     | 완료 | GMS, ITSS, APS 상태 전이 및 세션 타이머             |
| Persona & memory        | 완료 | 아리아-09 구조화 페르소나와 3단계 기억 파이프라인   |
| Contradiction debugging | 완료 | 실제 DOM 텍스트 드래그, 오프셋 매칭, 반박문 검증    |
| Overclock & hijacking   | 완료 | 60FPS 하트비트, 게이지, 글리치, 팝업, 마우스 흔들림 |
| DPO & privacy           | 완료 | 성공한 교정문 PII 마스킹 및 IndexedDB 로컬 큐 저장  |
| Save data               | 완료 | 사용자 프로필, 캐릭터 진행도, 텔레메트리 큐         |
| QA                      | 완료 | 인게임 QA 검증실과 자동 회귀·전체 플레이 E2E        |

## 빠른 시작

### 요구 사항

- Node.js 20 이상
- npm
- 최신 Chrome 또는 Edge

기본 Demo Core에는 WebGPU, Ollama, Supabase 계정이 필요하지 않습니다.

### 설치 및 실행

```powershell
git clone https://github.com/KIMNAMHYEON92/DAIS.git
cd DAIS
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1
```

브라우저에서 [http://127.0.0.1:5173](http://127.0.0.1:5173)을 엽니다.

프로덕션 빌드를 로컬에서 확인하려면 다음 명령을 사용합니다.

```powershell
npm.cmd run build
npm.cmd run preview -- --host 127.0.0.1
```

## 게임 플레이 방법

1. 로비의 추론 엔진에서 `Demo Core`를 선택합니다.
2. **심문 세션 개시**를 누릅니다.
3. 추천 질문 **3번 보관고**를 선택하고 전송합니다.
4. 아리아의 답변에서 **“3월 10일”**을 마우스로 드래그합니다.
5. 열린 디버깅 콘솔에 아래와 같은 교정문을 입력합니다.

```text
공장 가동일은 3월 15일이고, 3월 29일 전술 코어 탈취 기록이 존재합니다.
```

6. 교정 성공으로 과열 게이지가 감소하는지 확인합니다.
7. **최종 판정으로 이동**을 누르고 **불량 · 처분**을 제출합니다.
8. 결과 화면에서 보상, 동기화율, 로컬 DPO 큐 적재를 확인합니다.

과열 게이지가 상승하면 스캔라인과 경고 팝업이 나타나며, 90% 이상에서는 입력과 포인터를 방해합니다. 100% 또는 세션 시간 만료 시 파괴 엔딩으로 전이됩니다.

## 추론 엔진

### Demo Core

- 기본값이며 추가 설치가 없습니다.
- 아리아-09의 핵심 질문과 모순 발화를 결정론적으로 스트리밍합니다.
- UI, FSM, 기억, 드래그, 교정, 과열, 판정, 저장까지 전체 게임 루프를 실행합니다.
- 개발·리뷰·오프라인 시연에 적합합니다.

### Ollama

로컬 Ollama에서 `gemma-4-e2b` 모델을 제공하는 환경이라면 로비에서 Ollama 모드를 선택할 수 있습니다.

```powershell
ollama serve
ollama pull gemma-4-e2b
```

Ollama 엔드포인트는 `http://localhost:11434`를 사용합니다. 서버 미실행, 모델 미설치, CORS 또는 응답 오류가 발생하면 화면의 엔진 표시가 `OLLAMA → DEMO`로 바뀌고 Demo Core가 세션을 이어갑니다.

## 실행 경로

| 경로        | 용도                                 |
| ----------- | ------------------------------------ |
| `/`         | 실제 플레이 가능한 DAIS MVP          |
| `/?mode=qa` | Milestone 9 TC-1~TC-5 수동 QA 검증실 |

QA 검증실의 상세 절차는 [Milestone 9 사용자 교차검증 가이드](docs/M9_MANUAL_QA_GUIDE.md)를 참고하십시오.

## 핵심 아키텍처

```text
Browser Game UI (GameApplication / UiBridge)
              │
              ▼
        GameManager
   ┌──────────┼───────────┐
   ▼          ▼           ▼
FSMs      Gameplay      Memory
GMS/ITSS  Drag/Debug    Short/Mid/Long
APS       Overclock
   │          │           │
   └──────────┼───────────┘
              ▼
 Demo Core / Ollama → Markup streaming
              │
              ▼
 IndexedDB save + PII-redacted DPO queue
```

UI는 `UiBridge`를 구현하며, 게임 도메인은 DOM이나 특정 프레임워크에 직접 의존하지 않습니다. `GameManager`가 60FPS 하트비트, 로컬 추론, 기억 롤다운, 상태 전이, 모순 판정, 교정 보상 및 저장을 조율합니다.

## 테스트 및 빌드

```powershell
# 전체 회귀 테스트
npm.cmd test

# 실제 DOM 드래그를 포함한 플레이 데모 E2E
npm.cmd run test:demo

# Milestone 10 코어 전체 세션 통합 테스트
npm.cmd run test:m10

# Milestone 9 QA 테스트
npm.cmd run test:m9

# 타입 검사 및 프로덕션 번들
npm.cmd run build
```

현재 검증 기준:

- Test files: **16 passed**
- Tests: **91 passed**
- Playable DOM E2E: **passed**
- Production build: **passed**
- Browser console errors: **0**

## 기술 스택

| 영역            | 기술                                |
| --------------- | ----------------------------------- |
| Language        | TypeScript                          |
| Build           | Vite                                |
| Testing         | Vitest, jsdom, fake-indexeddb       |
| Game UI         | Native DOM, CSS                     |
| Local inference | Demo Core, optional Ollama          |
| AI architecture | WebGPU/WebLLM-ready domain boundary |
| Local storage   | IndexedDB                           |
| Privacy         | Client-side PII redaction           |

## 프로젝트 구조

```text
src/
├── game/
│   └── ariaPack.ts          # 실제 데모 캐릭터 팩
├── core/
│   ├── gameManager.ts       # 전역 게임플레이 오케스트레이터
│   ├── fsm/                 # GMS, ITSS, APS
│   ├── hijack/              # 글리치, 팝업, 입력 방해
│   ├── memory/              # 3단계 기억과 토큰 예산
│   ├── parser/              # 모순 매칭과 마크업
│   ├── prompt/              # 페르소나 컴파일
│   ├── sync/                # PII와 DPO 동기화 큐
│   └── validator/           # 반박문과 과열 검증
├── infrastructure/
│   ├── demoLocalClient.ts   # 무설치 데모 및 Ollama 폴백
│   ├── ollamaClient.ts      # Ollama 스트리밍
│   ├── dom/                 # Selection API 캡처
│   └── indexeddb/           # 로컬 저장소
├── types/                   # 정적 계약과 UiBridge
└── view/
    ├── gameApp.ts           # 실제 플레이 UI
    ├── gameStyles.css       # 게임 화면과 반응형 연출
    ├── qaApp.ts             # 수동 QA 검증실
    └── main.ts              # 게임/QA 라우팅

tests/
├── core/
├── infrastructure/
└── integration/
    ├── playableDemo.spec.ts
    ├── gameSystemIntegration.spec.ts
    └── qaValidator.spec.ts
```

## MVP 데모와 운영 배포의 경계

현재 저장소는 핵심 게임 루프를 직접 플레이할 수 있는 로컬 MVP입니다. 다음 항목은 운영 서비스 배포 시 별도 연결 또는 실측이 필요합니다.

- 실제 WebLLM 1.5GB 모델 다운로드와 GPU별 성능 KPI
- 운영 Supabase API 및 사용자 동의 UI
- Live2D·보이스·상용 게임 아트 자산
- 운영용 계정, 클라우드 세이브, 콘텐츠 배포

운영 API가 연결되지 않은 현재 빌드에서는 DPO 데이터가 외부로 전송되지 않고 PII 마스킹 후 IndexedDB에만 보존됩니다.

## 개인정보 원칙

- 교정문은 서버 경계 이전에 클라이언트에서 비식별화합니다.
- 주민등록번호, 전화번호, 이메일과 문맥상 실명을 대체 토큰으로 변환합니다.
- 기본 데모는 원격 수집 서버를 사용하지 않습니다.
- 테스트에는 실제 개인정보를 입력하지 마십시오.

## 문서

- [전체 제품 및 아키텍처 명세](DAIS.txt)
- [Milestone 9 사용자 교차검증 가이드](docs/M9_MANUAL_QA_GUIDE.md)
- [Milestone 9 Agent QA 결과 보고서](docs/reports/M9_AGENT_QA_REPORT.md)

## 라이선스

별도 라이선스가 명시되기 전까지 코드와 자산의 무단 사용·배포를 허용하지 않습니다.
