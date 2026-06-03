import "./loadenv";
import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY 가 설정되지 않았습니다.");
}

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** 채팅 응답 모델 */
export const CHAT_MODEL = "gpt-4o-mini";
/** 임베딩 모델 (1536 차원) */
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIM = 1536;

/** 텍스트 한 건을 임베딩 벡터로 변환 */
export async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.replace(/\n/g, " ").trim(),
  });
  return res.data[0].embedding;
}

/** 여러 텍스트를 한 번에 임베딩 (배치) */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts.map((t) => t.replace(/\n/g, " ").trim()),
  });
  return res.data.map((d) => d.embedding);
}
