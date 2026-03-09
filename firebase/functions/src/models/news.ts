/*
NewsDocument : Firestore에 저장될 실제 뉴스 문서 형태
NewsKind는 death, no_death, result
updatedAt은 수정 전 까지 null
*/

import {Timestamp} from "firebase-admin/firestore";

export type NewsKind = "death" | "no_death" | "result";
export type NewsVisibility = "public";

export interface NewsDocument {
  newsId: string;
  roomId: string;

  kind: NewsKind;
  visibility: NewsVisibility;

  dayNumber: number;
  headline: string;
  body: string;

  eliminatedPlayerUid: string | null;

  createdAt: Timestamp;
  updatedAt: Timestamp | null;
}

export interface CreateNewsInput {
  roomId: string;
  kind: NewsKind;
  visibility?: NewsVisibility;
  dayNumber: number;
  headline: string;
  body: string;
  eliminatedPlayerUid?: string | null;
}

export function createInitialNewsDocument(
  newsId: string,
  input: CreateNewsInput,
): NewsDocument {
  return {
    newsId,
    roomId: input.roomId,

    kind: input.kind,
    visibility: input.visibility ?? "public",

    dayNumber: input.dayNumber,
    headline: input.headline,
    body: input.body,

    eliminatedPlayerUid: input.eliminatedPlayerUid ?? null,

    createdAt: Timestamp.now(),
    updatedAt: null,
  };
}