/*
roomId를 검증합니다
뉴스 객체 존재를 검증합니다
뉴스가 해당 room용인지 검증합니다
room 존재를 확인합니다
newsId를 부여합니다
repository로 저장합니다
저장된 뉴스를 반환합니다
*/
import {randomUUID} from "node:crypto";

import {getRoomById} from "../../../repositories/roomRepository";
import {createNews} from "../../../repositories/newsRepository";
import type {BuiltNightNews} from "./buildNightNews";

export interface PublishNewsInput {
  roomId: string;
  news: BuiltNightNews;
}

export interface PublishedNews extends BuiltNightNews {
  newsId: string;
}

export async function publishNews(
  input: PublishNewsInput,
): Promise<PublishedNews> {
  const roomId = input.roomId.trim();
  const news = input.news;

  if (!roomId) {
    throw new Error("Room ID is required.");
  }

  if (!news) {
    throw new Error("News is required.");
  }

  if (news.roomId !== roomId) {
    throw new Error("News roomId does not match the requested room.");
  }

  const room = await getRoomById(roomId);

  if (!room) {
    throw new Error("Room not found.");
  }

  const publishedNews: PublishedNews = {
    newsId: randomUUID(),
    ...news,
  };

  await createNews(publishedNews);

  return publishedNews;
}