# Firestore Security Rules (PlayMafiaLocal)

본 문서는 PlayMafiaLocal의 Firestore 보안 규칙 설계 원칙과 예시 규칙을 정의한다.  
목표는 **서버 권위(server-authoritative)** 구조를 유지하면서도, 클라이언트가 필요한 UI/행동만 수행하도록 최소 권한을 부여하는 것이다.

> 전제
- 모든 클라이언트는 Firebase Auth로 로그인한다(권장: Anonymous Auth).
- 게임의 핵심 상태(`rooms.state`, `players.alive`, `players_private.role`, `news`)는 **서버(Cloud Functions)** 가 결정/작성한다.
- 클라이언트는 **자기 정보(닉네임/색상) 입력**, **행동 제출(actions 생성)** 정도만 쓰기 권한을 갖는다.

## 1) 권한 정책 요약(가장 중요)

### 서버만 쓰기 (Client write 금지)
- `rooms/{roomId}`: state/phase 전환, 승리 처리 등
- `rooms/{roomId}/players/{uid}.alive`: 생사 변경
- `rooms/{roomId}/players_private/{uid}.role`: 역할 배정
- `rooms/{roomId}/news/{phaseId}`: 뉴스 생성/수정
- (선택) `rooms/{roomId}.playerCount/aliveCount` 같은 카운터

### 클라이언트가 쓸 수 있는 것(최소)
- `rooms/{roomId}/players/{uid}`:
  - **본인 문서만** 생성/삭제(입장/퇴장)
  - **본인 문서의 nickname/color만** 수정(조건부)
- `rooms/{roomId}/actions/{phaseId}_{uid}`:
  - **본인 문서만** “생성(create)” (수정/삭제 불가)
- `users/{uid}.currentRoomId`:
  - 본인만 읽기/쓰기
  - 단, “실제 소속 room과 일치”하도록 제한(권장)

## 2) 추천 데이터 민감도 분리

- 공개 프로필: `rooms/{roomId}/players/{uid}` (닉네임, 색상, alive)
- 역할(비공개): `rooms/{roomId}/players_private/{uid}` (role)
  - 보안 규칙에서 **본인만 read** 가능

## 3) Firestore Rules 예시 (권장안)

> 아래는 “서버 권위 + 클라 최소 권한”을 목표로 한 예시다.  
> 로컬 에뮬레이터에서도 그대로 사용 가능하며, 배포 시에도 안전하다.

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ---------- Helpers ----------
    function signedIn() {
      return request.auth != null;
    }

    function isSelf(uid) {
      return signedIn() && request.auth.uid == uid;
    }

    function roomRef(roomId) {
      return /databases/$(database)/documents/rooms/$(roomId);
    }

    function roomDoc(roomId) {
      return get(roomRef(roomId));
    }

    function roomState(roomId) {
      return roomDoc(roomId).data.state;
    }

    function roomPhaseId(roomId) {
      return roomDoc(roomId).data.phaseId;
    }

    function isMember(roomId) {
      return exists(/databases/$(database)/documents/rooms/$(roomId)/players/$(request.auth.uid));
    }

    function selfPlayer(roomId) {
      return get(/databases/$(database)/documents/rooms/$(roomId)/players/$(request.auth.uid));
    }

    function isAlive(roomId) {
      return isMember(roomId) && selfPlayer(roomId).data.alive == true;
    }

    // 허용 필드 체크(화이트리스트)
    function onlyHasKeys(data, allowedKeys) {
      // Firestore Rules에는 "정확히 이 키만"을 강제하기 위해
      // data.keys().hasOnly([...])를 사용한다.
      return data.keys().hasOnly(allowedKeys);
    }

    // ---------- users/{uid} ----------
    match /users/{uid} {
      allow read: if isSelf(uid);

      // 본인만 작성/수정 가능
      // currentRoomId는 "내가 rooms/{roomId}/players/{uid}에 존재할 때만" 해당 roomId로 설정하도록 권장
      allow create, update: if isSelf(uid)
        && onlyHasKeys(request.resource.data, ['currentRoomId', 'nicknameCache', 'colorCache'])
        && (
          // currentRoomId가 null이면 항상 허용
          request.resource.data.currentRoomId == null
          ||
          // null이 아니면: 그 room의 멤버여야 함
          exists(/databases/$(database)/documents/rooms/$(request.resource.data.currentRoomId)/players/$(uid))
        );

      allow delete: if isSelf(uid);
    }

    // ---------- rooms/{roomId} ----------
    match /rooms/{roomId} {
      // room 목록 표시/상태 확인을 위해 로그인 유저는 읽기 허용
      allow read: if signedIn();

      // room 문서 자체의 쓰기는 서버만(클라 금지)
      allow create, update, delete: if false;

      // ---------- rooms/{roomId}/players/{uid} ----------
      match /players/{uid} {
        // 멤버만 서로의 공개 프로필을 읽게(권장)
        // (room_select에서 대기 인원 등을 보여주고 싶으면 rooms 문서에 playerCount를 두고 rooms만 읽어서 해결)
        allow read: if signedIn() && isMember(roomId);

        // 입장: 본인 문서만 생성 가능 + LOBBY에서만
        // alive는 클라가 조작 못하게 항상 true로 시작 강제
        allow create: if isSelf(uid)
          && roomState(roomId) == "LOBBY"
          && onlyHasKeys(request.resource.data, ['nickname', 'color', 'alive', 'joinedAt', 'lastSeenAt'])
          && request.resource.data.alive == true;

        // 닉네임/색상 변경: 본인만 + LOBBY에서만 + alive는 변경 불가
        allow update: if isSelf(uid)
          && roomState(roomId) == "LOBBY"
          && onlyHasKeys(request.resource.data, ['nickname', 'color', 'alive', 'joinedAt', 'lastSeenAt'])
          && request.resource.data.alive == resource.data.alive
          && request.resource.data.joinedAt == resource.data.joinedAt;

        // 퇴장: 본인만 + LOBBY에서만 삭제 허용(게임 중 강퇴/퇴장은 서버 정책으로)
        allow delete: if isSelf(uid) && roomState(roomId) == "LOBBY";
      }

      // ---------- rooms/{roomId}/players_private/{uid} ----------
      match /players_private/{uid} {
        // 본인만 역할 읽기 허용
        allow read: if isSelf(uid) && isMember(roomId);

        // 역할/비공개 정보는 클라 쓰기 금지(서버만)
        allow create, update, delete: if false;
      }

      // ---------- rooms/{roomId}/actions/{actionId} ----------
      match /actions/{actionId} {
        // 액션은 보통 서버가 집계하므로: 멤버만 읽기(또는 서버만 읽기)
        allow read: if signedIn() && isMember(roomId);

        // 액션 제출: 본인만 "생성(create)" 가능
        // 문서 ID는 반드시 "{phaseId}_{uid}" 형식으로 강제하여 페이즈당 1회 제출을 구조적으로 보장
        allow create: if signedIn()
          && isMember(roomId)
          && isAlive(roomId)
          && actionId == (roomPhaseId(roomId) + "_" + request.auth.uid)
          && onlyHasKeys(request.resource.data, ['uid', 'phaseId', 'type', 'targetUid', 'targetRoomNumber', 'submittedAt'])
          && request.resource.data.uid == request.auth.uid
          && request.resource.data.phaseId == roomPhaseId(roomId)
          && (
            // NIGHT에는 NIGHT_SCAN만
            (roomState(roomId) == "NIGHT" && request.resource.data.type == "NIGHT_SCAN" && request.resource.data.targetRoomNumber is string)
            ||
            // DAY에는 VOTE만
            (roomState(roomId) == "DAY" && request.resource.data.type == "VOTE" && request.resource.data.targetUid is string)
          );

        // 수정/삭제 금지(불변 로그)
        allow update, delete: if false;
      }

      // ---------- rooms/{roomId}/news/{phaseId} ----------
      match /news/{phaseId} {
        // 멤버만 읽기(뉴스는 해당 방 참가자에게만)
        allow read: if signedIn() && isMember(roomId);

        // 서버만 작성/수정
        allow create, update, delete: if false;
      }
    }
  }
}

## 4) 구현 시 꼭 알아둘 한계(용량/정원 체크)

Firestore Security Rules는 **서브컬렉션 문서 개수를 세는 것(=정원 full 체크)** 을 안정적으로 하기 어렵다.
따라서 “방 정원(full) 방지”는 아래 중 하나로 처리하는 것을 강력 추천한다.

### A안(권장): join/exit를 Cloud Function으로만 처리

* 클라이언트는 `joinRoom(roomId, nickname, color)` callable을 호출
* 함수가 트랜잭션으로:

  * 현재 playerCount 확인
  * players/{uid} 생성
  * users/{uid}.currentRoomId 갱신
  * rooms/{roomId}.playerCount 증가
* Rules는 클라이언트의 players create/delete를 더 강하게 막아도 됨

### B안(빠른 개발): rooms에 `playerCount`를 두고 Rules에서 비교

* 단, `playerCount`는 서버만 수정해야 함(클라 조작 방지)
* 클라가 직접 players create를 허용하면 경합/동기화 문제를 함수보다 더 신경써야 함

## 5) 로컬 개발(에뮬레이터) 편의 모드(선택)

개발 중 UI 확인이 번거로우면 아래처럼 “읽기”만 약간 풀 수 있다(배포 전 반드시 원복).

* `rooms/{roomId}/players` read를 `signedIn()`까지 완화
  (단, 방 외부 사용자가 닉네임을 볼 수 있게 되므로 배포 시에는 멤버만으로 제한 권장)

## 6) 체크리스트(배포 전)

* [ ] Anonymous Auth(또는 일반 Auth) 필수 적용 → `request.auth.uid`가 항상 존재
* [ ] role은 `players_private`에만 존재(공개 players에 role 없음)
* [ ] `rooms` 문서 쓰기/`alive` 변경은 클라 불가
* [ ] actions는 create-only + `{phaseId}_{uid}` 강제
* [ ] room 정원 로직은 Functions(권장) 또는 서버-전용 카운터로 처리

## 7) 변경 로그

* 2026-03-06: 초안 작성 (서버 권위 구조 기준 규칙 예시 포함)
