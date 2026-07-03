# DAIS

> **Defective Android Interrogation Station**  
> 대화 속 모순을 포착하고 안드로이드의 논리를 직접 디버깅하는 온디바이스 AI 심문 게임

![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-87%20tests-6E9F18?logo=vitest&logoColor=white)
![MVP](https://img.shields.io/badge/MVP-Milestone%209%20Complete-35E0A1)

DAIS는 플레이어가 검사관이 되어 AI 안드로이드를 심문하고, NPC 발화의 모순을 드래그한 뒤 논리적 반박문을 입력해 오류를 교정하는 브라우저 게임 프로젝트입니다. WebGPU/WebLLM 기반 로컬 추론, 3단계 기억 압축, 과열 및 UI 하이재킹, 비식별 DPO 데이터 수집을 하나의 게임 루프로 설계했습니다.

## 프로젝트 상태

**MVP Milestone 1~9 구현 완료**

Milestone 9에서는 자동 통합 검증과 사용자가 직접 TC-1~TC-5를 재현하고 판정할 수 있는 QA 검증실을 완성했습니다.

| 영역 | 상태 | 구현 내용 |
| --- | --- | --- |
| Core FSM | 완료 | GMS, ITSS, APS 상태 전이와 경계 조건 |
| Persona & Prompt | 완료 | 구조화 페르소나, GM 마크업 파서, 프롬프트 컴파일 |
| Memory | 완료 | 단기 롤링, 중기 요약, 장기 앵커 및 토큰 예산 |
| Gameplay | 완료 | DOM 드래그, 모순 매칭, 반박문 검증, 과열 계산 |
| UI Hijacking | 완료 | 스캔라인, 경고 팝업, 흔들림, 입력 유실 |
| DPO & Privacy | 완료 | PII 마스킹, IndexedDB 큐, 5건 단위 복구 동기화 |
| Modding | 완료 | 캐릭터 팩 및 메모리 앵커 스키마 검증 |
| QA / Milestone 9 | 완료 | KPI 계측, TC-1~5 통합 테스트, 수동 검증 UX와 결과 내보내기 |

현재 저장소는 **MVP 기능 구현 및 로컬 QA 기준 완료 상태**입니다. 실제 WebLLM 모델 파일, GPU별 성능 KPI, 운영 Supabase 엔드포인트는 배포 환경에 종속되므로 커뮤니티 알파 배포 전에 별도 실기기 검증이 필요합니다.

## 핵심 게임 루프

1. 안드로이드 캐릭터를 선택하고 심문을 시작합니다.
2. 질문을 통해 NPC의 기억 오류와 모순 발화를 유도합니다.
3. 대화 로그에서 모순 구간을 정확히 드래그합니다.
4. 제한 시간 안에 근거가 포함된 반박문을 입력합니다.
5. 성공 시 과열 게이지를 낮추고 동기화율과 보상을 획득합니다.
6. 실패 또는 방치 시 UI 하이재킹이 강화되고 파괴 엔딩으로 전이됩니다.
7. 성공한 교정문은 로컬에서 개인정보를 비식별화한 뒤 DPO 큐에 저장됩니다.

## 주요 기능

- **온디바이스 AI 아키텍처**: WebGPU/WebLLM 기반 로컬 추론 및 오프라인 우선 설계
- **구조화 페르소나**: 캐릭터 JSON과 가드레일을 이용한 일관된 역할 수행
- **3단계 기억 시스템**: 컨텍스트 한계 안에서 단기·중기·장기 기억 관리
- **모순 디버깅**: DOM Selection API 오프셋 캡처와 결정론적 키워드 검증
- **실시간 과열 시스템**: 상태별 가중치, 이벤트 패널티, 성공 시 `-30%`
- **공격적인 UI 연출**: 80% 팝업, 90% 입력 방해, 100% 파괴 상태
- **Privacy-first DPO**: 주민번호·전화번호·이메일·문맥 기반 이름 마스킹
- **오프라인 동기화**: IndexedDB 적재 후 네트워크 복구 시 5건 단위 업로드
- **모딩 규격**: 캐릭터 정보, 시스템 프롬프트, 메모리 앵커 구조 검증
- **사용자 QA 검증실**: 자동 증거와 테스터 판정을 분리하고 JSON/Markdown으로 결과 보존

## 빠른 시작

### 요구 사항

- Node.js 20 이상
- npm
- 최신 Chrome 또는 Edge
- 실제 로컬 추론 검증 시 WebGPU 지원 GPU

### 설치 및 실행

```powershell
git clone https://github.com/KIMNAMHYEON92/DAIS.git
cd DAIS
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1
```

터미널에 표시된 주소(일반적으로 `http://127.0.0.1:5173/`)를 브라우저에서 엽니다.

## Milestone 9 QA 수행

QA 검증실은 다음 경험을 제공합니다.

- 게임 실행 환경과 WebGPU/IndexedDB 상태 확인
- TC-1~TC-5 단계별 조작 안내
- 드래그·반박·과열·PII·오프라인 큐의 시각적 증거
- 각 TC별 `PASS`, `FAIL`, `BLOCKED`, `PENDING` 직접 판정
- 관찰 메모와 실행 시각의 LocalStorage 보존
- 최종 결과 JSON 및 Markdown 내보내기

상세 절차는 [Milestone 9 사용자 교차검증 가이드](docs/M9_MANUAL_QA_GUIDE.md)를 따르십시오.

## 테스트 및 빌드

```powershell
# 전체 회귀 테스트
npm.cmd test

# Milestone 9 통합 테스트만 실행
npm.cmd run test:m9

# 타입 검사 및 프로덕션 번들
npm.cmd run build
```

현재 검증 기준:

- Test files: **13 passed**
- Tests: **87 passed**
- Production build: **passed**
- Browser console errors: **0**

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Language | TypeScript |
| Build / Dev Server | Vite |
| Testing | Vitest, jsdom, fake-indexeddb |
| Local AI | WebGPU, `@mlc-ai/web-llm` |
| Local Storage | IndexedDB |
| Optional Summarizer | Ollama |
| Styling | Native CSS |

## 프로젝트 구조

```text
src/
├── core/
│   ├── fsm/          # GMS, ITSS, APS 상태 머신
│   ├── hijack/       # 글리치, 팝업, 입력 방해
│   ├── memory/       # 토큰 예산과 3단계 기억
│   ├── modding/      # 캐릭터 모드 규격 검증
│   ├── parser/       # 모순 문장 매칭
│   ├── prompt/       # 페르소나 컴파일과 마크업 파싱
│   ├── qa/           # Milestone 9 KPI 계측 및 보고서
│   ├── sync/         # PII, DPO 큐, 복구 동기화
│   └── validator/    # 반박문 및 과열 검증
├── infrastructure/
│   ├── dom/          # 브라우저 텍스트 선택 캡처
│   ├── indexeddb/    # 로컬 데이터베이스
│   └── ollama/       # 선택적 로컬 요약 연동
├── types/            # 정적 데이터 계약
└── view/             # QA 검증실 UI

tests/
├── core/
├── infrastructure/
└── integration/      # TC-1~TC-5 Milestone 9 테스트

docs/
├── M9_MANUAL_QA_GUIDE.md
└── reports/M9_AGENT_QA_REPORT.md
```

## 문서

- [전체 제품 및 아키텍처 명세](DAIS.txt)
- [Milestone 9 사용자 교차검증 가이드](docs/M9_MANUAL_QA_GUIDE.md)
- [Milestone 9 Agent QA 결과 보고서](docs/reports/M9_AGENT_QA_REPORT.md)

## QA 판정 범위

저장소의 자동 테스트와 QA 픽스처는 로컬 코어 동작을 검증합니다. 다음 항목은 실제 배포 환경에서 추가 측정해야 합니다.

- 약 1.5GB 모델의 콜드 부팅 `≤ 30초`
- 캐시 부팅 `≤ 3초`
- 첫 토큰 지연 `≤ 1.2초`
- 추론 처리량 `≥ 25 tokens/sec`
- 30턴 대화 중 VRAM OOM 0회
- 실제 Supabase 수신과 로컬 큐 제거

## 개인정보 원칙

교정문 데이터는 서버 전송 전에 클라이언트에서 먼저 비식별화합니다. 테스트 시에도 실제 개인정보를 사용하지 말고 문서에 제공된 가짜 번호와 이메일만 사용하십시오.

## 라이선스

별도 라이선스가 명시되기 전까지 코드와 자산의 무단 사용·배포를 허용하지 않습니다.
