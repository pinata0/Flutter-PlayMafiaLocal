import {
  Timestamp,
  type CollectionReference,
  type Query,
} from "firebase-admin/firestore";

import {db} from "../shared/admin/firebaseAdmin";
import type {NewsDocument} from "../models/news";

const NEWS_COLLECTION = "news";

function newsCollection(): CollectionReference {
  return db.collection(NEWS_COLLECTION);
}

function newsQueryByRoomId(roomId: string): Query {
  return newsCollection().where("roomId", "==", roomId);
}

export async function createNews(news: NewsDocument): Promise<void> {
  await newsCollection().doc(news.newsId).set(news);
}

export async function getNewsById(newsId: string): Promise<NewsDocument | null> {
  const snapshot = await newsCollection().doc(newsId).get();

  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data() as NewsDocument;
}

export async function getNewsByRoomId(roomId: string): Promise<NewsDocument[]> {
  const snapshot = await newsQueryByRoomId(roomId)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => doc.data() as NewsDocument);
}

export async function getLatestNewsByRoomId(
  roomId: string,
): Promise<NewsDocument | null> {
  const snapshot = await newsQueryByRoomId(roomId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].data() as NewsDocument;
}

export async function updateNews(
  newsId: string,
  updates: Partial<NewsDocument>,
): Promise<void> {
  await newsCollection().doc(newsId).update({
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteNews(newsId: string): Promise<void> {
  await newsCollection().doc(newsId).delete();
}

export async function deleteNewsByRoomId(roomId: string): Promise<void> {
  const newsList = await getNewsByRoomId(roomId);

  if (newsList.length === 0) {
    return;
  }

  const batch = db.batch();

  for (const news of newsList) {
    batch.delete(newsCollection().doc(news.newsId));
  }

  await batch.commit();
}