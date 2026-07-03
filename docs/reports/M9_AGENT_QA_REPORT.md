# Milestone 9 Agent QA 결과 보고서

## 결론

현재 빌드는 Milestone 9의 **로컬 코어 자동 검증과 사용자 교차검증 하네스**를 갖추었지만, 실제 WebLLM 모델 자산과 Supabase 엔드포인트가 연결되어 있지 않아 커뮤니티 알파 릴리즈 기준 전체를 통과했다고 판정할 수 없습니다.

전체 판정: **CONDITIONAL / EXTERNAL VERIFICATION REQUIRED**

검증 실행일: 2026-07-03 (Asia/Seoul)

## 구현된 검증 구조

- QA KPI 타입 및 집계 엔진
- TC-1~TC-5 통합 회귀 테스트
- 실제 DOM 드래그 기반 TC-2 사용자 하네스
- 과열 단계 시각 주입과 입력 유실 관찰
- IndexedDB의 마스킹 페이로드 표시
- 오프라인 큐 → QA 수신기 동기화
- 테스터 PASS/FAIL/BLOCKED/PENDING 기록
- 결과 JSON/Markdown 내보내기
- 게임 실행부터 결과 제출까지의 수동 검증 가이드

## 케이스별 Agent 판정

| TC | 자동 검증 | 브라우저 하네스 | 실제 외부 환경 | Agent 판정 |
| --- | --- | --- | --- | --- |
| TC-1 | 로드 계측 API와 GMS 컨텍스트 초기화 검증 | 환경 감지와 페르소나 픽스처 제공 | 실제 WebLLM/VRAM 미연결 | PARTIAL |
| TC-2 | 모순 선택, 정상 문장 패널티 +8% 검증 | 실제 DOM 선택, 반박 키워드, -30% 표시 | 외부 의존 없음 | PASS |
| TC-3 | 60초 타임아웃 → DEATH_SEQUENCE 검증 | 80/90/100% 시각 주입과 입력 유실 | 실제 60초 게임 루프 미연결 | PARTIAL |
| TC-4 | 전화번호 마스킹과 IndexedDB 적재 검증 | 마스킹된 chosen 값을 화면에서 확인 | 외부 의존 없음 | PASS |
| TC-5 | 오프라인 적재, 복구 전송, 큐 삭제 검증 | 메모리 QA 수신기로 관찰 가능 | 실제 Supabase 미연결 | PARTIAL |

## 실행한 검증 결과

- 전체 Vitest: **13 test files / 87 tests PASS**
- Milestone 9 통합 테스트: **5 tests PASS**
- TypeScript + Vite 프로덕션 빌드: **PASS**
- 브라우저 Console error: **0건**
- TC-1 브라우저 QA 픽스처: **352.62ms**, WebGPU 감지, 자동 증거 `PARTIAL`
- TC-3 브라우저 80%: 스캔라인 ON, 경고 팝업 표시
- TC-3 브라우저 90%: 글리치 강도 0.95, 입력 유실 관찰
- TC-3 브라우저 100%: `SYSTEM COLLAPSE // ANDROID DAMAGED`, 자동 증거 `PASSED`
- TC-4 브라우저: 일반 한국어 문장을 보존하면서 전화·이메일만 치환, 자동 증거 `PASSED`
- TC-5 브라우저: `Local queue 1 / OFFLINE`에서 `Local queue 0 / QA receiver 1 / ONLINE`으로 전환, 자동 증거 `PASSED`

TC-2의 화면과 선택 대상은 브라우저에서 확인했으며, DOM Selection API의 오프셋 캡처와 matcher 연동은 자동 DOM/통합 테스트로 검증했습니다. 최종 사용자 교차검증에서는 가이드에 따라 실제 마우스로 `3월 10일`을 선택해 한 번 더 확인해야 합니다.

## Acceptance Criteria 판정

| 기준 | 상태 | 근거 |
| --- | --- | --- |
| AC-1 로컬 LLM 및 프롬프트 스위칭 | BLOCKED | GMS 초기화는 검증했으나 실제 모델/VRAM/캐릭터 B 자산이 없음 |
| AC-2 정밀 오프셋 드래그 및 모순 감지 | PASS | DOM Selection API, matcher, validator, 게이지 연동 |
| AC-3 PII 및 DPO 오프라인 적재 | PARTIAL | 로컬 마스킹·큐·복구는 통과, 실제 Supabase 수신은 미검증 |

## KPI 판정

| KPI | 목표 | 현재 상태 |
| --- | --- | --- |
| Cold boot | 30,000ms 이하 | 실제 모델 미연결로 미측정 |
| Cached boot | 3,000ms 이하 | 실제 모델 미연결로 미측정 |
| First token | 1,200ms 이하 | 실제 추론 미연결로 미측정 |
| Throughput | 25 tokens/sec 이상 | 실제 추론 미연결로 미측정 |
| 30턴 OOM | 0회 | 실제 VRAM 장기 실행 미측정 |
| 무관리 파괴 | 약 60초 | ITSS 상태 머신 자동 검증 |
| 디버깅 피드백 | 100ms 이하 | 하네스에서 로컬 처리 시간 표시, 테스터 장비별 확인 필요 |

## 발견 및 수정한 결함

기존 ITSS는 전역 세션 타이머가 `USER_WAIT`에서 만료되면 `DEATH_SEQUENCE`로 전이하도록 구현되어 있었지만, 전이 허용표에는 해당 경로가 없어 예외가 발생했습니다. `USER_WAIT`, `NPC_THINKING`, `CONTRADICTION_DRAGGED`에서 전역 타임아웃 파괴 전이를 허용하도록 수정했습니다.

기존 PII 이름 추정 필터는 일반적인 2~4글자 한국어 단어까지 사람 이름으로 판단하여 DPO 교정문 대부분을 `[USER_NAME]`으로 훼손했습니다. 이름·직책·주민번호 등 명시적인 식별 문맥에서만 이름 토큰을 치환하도록 범위를 좁혔고, 전화번호와 이메일은 그대로 완전 마스킹되는 것을 브라우저에서 다시 확인했습니다.

## 릴리즈 전 남은 필수 작업

1. 실제 WebLLM 모델 로더와 캐릭터 A/B 자산 연결
2. 콜드/캐시/첫 토큰/throughput 실측 계측점 연결
3. 30턴 브라우저 VRAM 장기 실행
4. 실제 세션 타이머와 과열 렌더 루프를 UI에 연결
5. Supabase 테스트 프로젝트 연결 및 `data_id` 단위 수신 확인
6. 두 개 이상의 기준 장비에서 사용자 가이드 전수 수행

최종 릴리즈 판정은 위 항목을 수행한 사용자 결과 JSON/Markdown과 실제 서버 증거를 병합한 뒤 내려야 합니다.
