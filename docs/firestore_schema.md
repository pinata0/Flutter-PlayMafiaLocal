# Firestore Schema (PlayMafiaLocal)

본 문서는 PlayMafiaLocal의 Firestore 데이터 구조(컬렉션/문서/필드)를 정의한다.  
목표는 **클라이언트 UI 구독이 쉬우면서**, **치트 방지(권한 분리)** 가 가능한 스키마를 제공하는 것이다.

## 1. Collections Overview

users (collection)
 └─ {uid} (document)
     - currentRoomId

rooms (collection)
 └─ {roomId} (document)
     - state / dayNumber / phaseId / phaseEndsAt ...

rooms/{roomId}/players (subcollection)
 └─ {uid} (document)
     - nickname / color / alive ...

rooms/{roomId}/players_private (subcollection)
 └─ {uid} (document)
     - role

rooms/{roomId}/actions (subcollection)
 └─ {phaseId}_{uid} (document)
     - type / targetUid? / targetRoomNumber? ...

rooms/{roomId}/news (subcollection)
 └─ {phaseId} (document)
     - message / imageKey ...

## 2. `users/{uid}`

재접속 시 “내가 어느 room에 있었는지”를 빠르게 찾기 위한 사용자 루트 문서.

| Field           | Type          | Required | Example     | Notes              |
| --------------- | ------------- | -------: | ----------- | ------------------ |
| `currentRoomId` | string | null |       ✅ | `"room_01"` | 방에 속해있지 않으면 `null` |
| `nicknameCache` | string        |       ❌ | `"홍길동"`     | 선택: UI 초기 표시용 캐시   |
| `colorCache`    | string        |       ❌ | `"#FFAA00"` | 선택                 |

## 3. `rooms/{roomId}` (Room Document)

게임 상태를 대표하는 문서. 클라이언트는 이 문서를 실시간 구독해서 UI를 전환한다.

| Field            | Type                | Required | Example        | Notes                  |       |     |        |
| ---------------- | ------------------- | -------: | -------------- | ---------------------- | ----- | --- | ------ |
| `capacity`       | int                 |        ✅ | `8`            | 방 정원                   |       |     |        |
| `state`          | string(enum)        |        ✅ | `"LOBBY"`      | `LOBBY                 | NIGHT | DAY | ENDED` |
| `dayNumber`      | int                 |        ✅ | `3`            | 1부터 증가                 |       |     |        |
| `phaseId`        | string              |        ✅ | `"D003_NIGHT"` | 페이즈 고유 ID              |       |     |        |
| `phaseStartedAt` | timestamp           |        ✅ |                | 서버 기준                  |       |     |        |
| `phaseEndsAt`    | timestamp           |        ✅ |                | 서버 기준(예: 06:00, 00:00) |       |     |        |
| `aliveCount`     | int                 |        ❌ | `6`            | 선택: UI 상단 표시 최적화       |       |     |        |
| `winner`         | string(enum) | null |        ❌ | `"MAFIA"`      | `ENDED`에서만             |       |     |        |
| `createdAt`      | timestamp           |        ✅ |                |                        |       |     |        |
| `updatedAt`      | timestamp           |        ✅ |                |                        |       |     |        |

> 권장: `order` 대신 `dayNumber + phaseId`로 명확하게 구분한다.

## 4. `rooms/{roomId}/players/{uid}` (Public Player Document)

**모든 참가자가 볼 수 있는 정보만** 둔다.
특히 `role(class)`는 여기 두지 않는 것을 권장(치트 방지).

| Field        | Type      | Required | Example     | Notes        |
| ------------ | --------- | -------: | ----------- | ------------ |
| `nickname`   | string    |        ✅ | `"철수"`      | join 후 입력    |
| `color`      | string    |        ✅ | `"#3D5AFE"` | 프로필 색상       |
| `alive`      | bool      |        ✅ | `true`      | 서버만 수정 권장    |
| `joinedAt`   | timestamp |        ✅ |             |              |
| `lastSeenAt` | timestamp |        ❌ |             | 선택: 접속 상태 추정 |

## 5. `rooms/{roomId}/players_private/{uid}` (Private Player Document)

**본인만 읽을 수 있어야 하는 정보**를 분리한다.

| Field            | Type         | Required | Example   | Notes  |         |      |
| ---------------- | ------------ | -------: | --------- | ------ | ------- | ---- |
| `role`           | string(enum) |        ✅ | `"MAFIA"` | `MAFIA | CITIZEN | ...` |
| `roleAssignedAt` | timestamp    |        ❌ |           | 선택     |         |      |

> 보안 규칙에서 “본인만 read 가능”으로 제한하는 것을 전제로 한다.

## 6. `rooms/{roomId}/actions/{phaseId}_{uid}` (Action Document)

한 페이즈에 플레이어가 제출하는 행동 기록.
문서 ID를 `{phaseId}_{uid}`로 고정하면 **중복 제출 방지**가 구조적으로 쉬워진다.

### 공통 필드

| Field         | Type         | Required | Example        | Notes              |       |
| ------------- | ------------ | -------: | -------------- | ------------------ | ----- |
| `uid`         | string       |        ✅ | `"uid123"`     | 작성자                |       |
| `phaseId`     | string       |        ✅ | `"D003_NIGHT"` | room의 현재 `phaseId` |       |
| `type`        | string(enum) |        ✅ | `"NIGHT_SCAN"` | `NIGHT_SCAN        | VOTE` |
| `submittedAt` | timestamp    |        ✅ |                | 서버 시간 권장           |       |

### NIGHT_SCAN 타입 추가 필드

| Field              | Type   | Required | Example | Notes |
| ------------------ | ------ | -------: | ------- | ----- |
| `targetRoomNumber` | string |        ✅ | `"201"` | QR 내용 |

### VOTE 타입 추가 필드

| Field       | Type   | Required | Example    | Notes     |
| ----------- | ------ | -------: | ---------- | --------- |
| `targetUid` | string |        ✅ | `"uid777"` | 투표 대상 uid |

> 서버 검증 권장:

* `rooms/{roomId}.state == NIGHT`면 `type == NIGHT_SCAN`만 허용
* `rooms/{roomId}.state == DAY`면 `type == VOTE`만 허용
* `submittedAt <= phaseEndsAt`만 인정(전환 순간 엣지케이스)

## 7. `rooms/{roomId}/news/{phaseId}` (News Document)

페이즈 시작 시 표시되는 공지/일러스트. 클라이언트는 `phaseId` 기준으로 최초 1회 표시한다.

| Field       | Type      | Required | Example          | Notes                    |
| ----------- | --------- | -------: | ---------------- | ------------------------ |
| `message`   | string    |        ✅ | `"00가 사망하였습니다."` |                          |
| `imageKey`  | string    |        ❌ | `"death_01"`     | assets key 또는 storage 경로 |
| `imageUrl`  | string    |        ❌ |                  | storage 직접 URL 사용 시      |
| `createdAt` | timestamp |        ✅ |                  |                          |

## 8. 권장 인덱스 / 쿼리 패턴

### 자주 쓰는 구독(Realtime)

* `rooms/{roomId}` (state/phaseId/endsAt 확인)
* `rooms/{roomId}/players` (alive 목록 UI)

### 자주 쓰는 읽기

* `rooms/{roomId}/players_private/{uid}` (내 역할 보기)
* `rooms/{roomId}/news/{phaseId}` (오버레이)

### 자주 쓰는 쓰기

* join/exit: `rooms/{roomId}/players/{uid}` 생성/삭제 + `users/{uid}.currentRoomId` 갱신
* action 제출: `rooms/{roomId}/actions/{phaseId}_{uid}` 생성

> `players`를 list로 두지 않는 이유:

* uid 탐색/수정이 빠르고 충돌이 덜함
* 동시 join/exit에 안전
* 보안 규칙 작성이 쉬움

## 9. (선택) 방 설정 문서 분리

room 문서가 커지면 설정만 별도로 두어도 된다.

rooms/{roomId}/config/main
 - capacity
 - allowColorDuplicate
 - minPlayersToStart

## 10. 변경 로그

* 2026-03-06: 초안 작성 (rooms / players / players_private / actions / news / users)
