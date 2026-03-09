# PlayMafiaLocal Flow & State Machine

본 문서는 PlayMafiaLocal의 **게임 상태(state) 전이**와 각 상태에서의 **클라이언트 화면/행동 규칙**을 정의한다.  
(Flutter 클라이언트 + Firebase(Functions/Rules/Firestore) 구조를 전제로 작성)

## 1. 용어

- **Room**: 하나의 게임 세션 단위.
- **Player**: room에 참가한 사용자(uid) 단위.
- **Phase**: 게임 진행 상태(LOBBY/NIGHT/DAY/ENDED).
- **phaseId**: 특정 페이즈를 고유하게 구분하는 문자열.
  - 예: `D003_NIGHT`, `D003_DAY`
- **Server**: Firebase Cloud Functions(또는 로컬 컴퓨터가 실행하는 서버 로직).
- **Client**: Flutter 앱.

## 2. 전체 상태(State) 정의

Room 문서(`rooms/{roomId}`)는 다음의 상태 중 하나를 가진다.

- `LOBBY`: 대기방(참가/퇴장 가능, 역할 미공개)
- `NIGHT`: 야간 행동(카메라/QR 제출)
- `DAY`: 주간 투표(플레이어 선택 후 제출)
- `ENDED`: 게임 종료(승리팀 확정)

> 선택 상태(옵션)
- `NEWS`: “뉴스 오버레이 표시 시간”을 상태로 분리하고 싶다면 사용 가능.  
  단, 구현 단순화를 위해 본 문서에서는 **NEWS는 state로 분리하지 않고** `news/{phaseId}` 문서를 “클라이언트 최초 1회 표시”로 처리하는 방식을 기본으로 한다.

## 3. 시간 규칙(Time Rule)

현실 시간 기준(로컬 시간)으로:

- **Nighttime Window**: 00:00 ~ 06:00
- **Daytime Window**: 06:00 ~ 24:00

권장 정책:
- 실제 전환은 서버가 `phaseEndsAt` 기반으로 결정한다.
- 클라이언트는 서버 문서의 `state`를 신뢰하고 UI를 전환한다.
- (선택) 서버가 정각(00:00 / 06:00)에 페이즈 전환 트리거를 수행한다.

## 4. Room State Machine (전이 다이어그램)

          (room 생성)
              |
              v
            LOBBY
              |
              | (start 조건 만족: 인원/관리자 시작/정해진 시각)
              v
            NIGHT
              |
              | (phaseEndsAt 도달 or 서버가 종료 선언)
              v
             DAY
              |
              | (phaseEndsAt 도달 or 투표 결과 처리 완료)
              v
            NIGHT
              |
              | (승리 조건 달성)
              v
            ENDED

### 4.1 전이 트리거(요약)

* `LOBBY -> NIGHT`

  * 조건 예시:

    * 최소 인원 충족 AND (관리자 시작 버튼 OR 00:00 도달)
* `NIGHT -> DAY`

  * `phaseEndsAt` 도달(06:00) 또는 서버가 야간 행동 수합 완료 선언
* `DAY -> NIGHT`

  * `phaseEndsAt` 도달(00:00) 또는 투표 수합/처리 완료 선언
* `ANY -> ENDED`

  * 승리 조건 달성(예: 마피아 전멸 / 시민 수 ≤ 마피아 수 등)

## 5. 페이즈 공통: News 오버레이 규칙

각 페이즈 시작 시 서버는 `rooms/{roomId}/news/{phaseId}` 문서를 생성한다.

클라이언트 규칙:

* 상태 전환으로 페이지에 진입할 때, 해당 `phaseId`의 news를 조회.
* **최초 1회만 표시**한다.

  * 추천: 로컬 저장소에 `lastSeenNewsPhaseId` 저장
  * `lastSeenNewsPhaseId != currentPhaseId`이면 표시 후 저장

## 6. 클라이언트 화면 매핑(UI Routing)

클라이언트는 앱 실행 또는 리스너 갱신 때 아래 규칙으로 “현재 화면”을 결정한다.

### 6.1 기본 라우팅 규칙

1. **현재 유저가 속한 room 탐색**

* 권장: `users/{uid}.currentRoomId` 사용
* 대안: 모든 room을 순회(비권장)

2. room이 없다면: `room_select`

3. room이 있으면:

* `rooms/{roomId}/players/{uid}.alive == false` -> `death`
* else `rooms/{roomId}.state`에 따라:

  * `LOBBY` -> `waiting`
  * `NIGHT` -> `nighttime`
  * `DAY` -> `daytime`
  * `ENDED` -> (전용 `ended` 페이지를 만들거나 `daytime`에서 종료 UI)

## 7. 상태별 클라이언트 행동 규칙

### 7.1 LOBBY (waiting / room_select)

**허용되는 클라이언트 행동**

* room_join 요청
* room_exit 요청
* 닉네임/색상 입력(본인 문서만)

**금지(서버만 가능)**

* 역할(role/class) 배정
* alive 변경
* state 변경

**화면**

* `room_select`: room 목록, join 버튼(조건부), 네트워크 에러 표시
* `waiting`: 참가자 프로필 리스트, exit 가능

### 7.2 NIGHT (nighttime)

**허용되는 클라이언트 행동**

* News 오버레이 확인(OK)
* Info(role) 오버레이 확인(OK) — role은 본인만 읽기
* QR 스캔 후 “확인 O” 시 야간 행동 제출:

  * `actions/{phaseId}_{uid}` 생성(또는 업데이트 불가, 1회만)

**야간 행동 제출 규칙**

* 한 페이즈에 유저당 1회만 제출 가능
* 제출 성공 시:

  * camera 버튼 비활성화/회색 처리

**서버 처리(예시)**

* 행동 수집 후 룰에 따라 결과 계산:

  * 누가 죽는지 결정
  * `players/{uid}.alive` 수정
  * `news/{nextPhaseId}` 생성 등

### 7.3 DAY (daytime)

**허용되는 클라이언트 행동**

* News 오버레이 확인(OK)
* 살아있는 플레이어 목록에서 1명 선택
* submit 시 투표 제출:

  * `actions/{phaseId}_{uid}` 생성(1회)

**투표 제출 규칙**

* 한 페이즈에 유저당 1회만 제출 가능
* 제출 전까지 선택 변경 자유
* 제출 후 UI 잠금(선택/submit 비활성화)

**서버 처리(예시)**

* 투표 집계
* 처형 대상 결정
* `players/{uid}.alive` 수정
* 승리조건 판단 후 `ENDED` 전환 가능

### 7.4 ENDED (game end)

**권장 처리**

* `rooms/{roomId}.winner = "MAFIA"|"CITIZEN"|...` 저장
* 클라이언트는 종료 UI 표시 + room 나가기 가능

**클라이언트 행동**

* OK/나가기 버튼:

  * `users/{uid}.currentRoomId = null`
  * `rooms/{roomId}/players/{uid}` 삭제(또는 leftAt 기록)

## 8. 서버 권한/검증 포인트(요약)

클라이언트가 임의로 게임을 망치지 못하도록 서버/Rules에서 반드시 보장해야 한다.

* state 전환은 서버만 쓰기
* alive 변경은 서버만 쓰기
* role은 서버만 쓰기 + 본인만 읽기
* actions 제출은:

  * 본인 uid만 제출 가능
  * `{phaseId}_{uid}` 문서가 이미 있으면 거부(중복 제출 방지)
  * phase가 NIGHT인데 VOTE 제출 같은 타입 불일치 거부

## 9. 엣지 케이스 정책

* 페이즈 전환 순간 제출:

  * 서버 timestamp 기준으로 `submittedAt <= phaseEndsAt`만 인정
* 네트워크 끊김:

  * 클라이언트 상단바에 경고 표시
  * 연결 복구 시 스냅샷 리스너로 자동 동기화
* 죽은 플레이어:

  * actions 제출 불가
  * 즉시 death 페이지로 라우팅

## 10. 변경 로그

* 2026-03-06: 초안 작성 (state: LOBBY/NIGHT/DAY/ENDED, news 문서 기반 1회 표시)