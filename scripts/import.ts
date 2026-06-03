/**
 * 노션 export(.md) → Supabase 임포트 스크립트  (NEXT 14기 데이터용)
 *
 * 실행:  npm run import                 # 기본 폴더 "넥스트 정보"
 *        npm run import -- "다른폴더"
 *
 * 동작: 폴더의 사람별 .md 파싱 → 필드 추출 + 성별 추론(GPT) + 전문 임베딩 → members upsert
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
config({ path: ".env.local" });

import { supabaseAdmin } from "../lib/supabase";
import { embedBatch, EMBEDDING_DIM, openai, CHAT_MODEL } from "../lib/openai";
import { parseMember, EXCLUDE_PREFIX } from "../lib/parseMember";

const DEFAULT_DIR = "넥스트 정보";

// 원본 .md 에 '생일'이 없어 출생연도를 못 뽑는 멤버를 수동 보정.
// (값을 알게 되면 여기에 채우면 됨. 예: 조혜진: 1999)
const BIRTH_YEAR_OVERRIDES: Record<string, number> = {
  // 조혜진: 1999,
  // 배상일: 0000,
  // 안지한: 0000,
};

/** 이름 기반 성별 추론 (데이터에 성별 필드가 없어 GPT로 1회 추정). */
async function inferGenders(names: string[]): Promise<Record<string, string>> {
  const res = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "한국 이름의 일반적 성별을 추정한다. 반드시 {\"이름\":\"남\"|\"여\", ...} 형태의 JSON 하나만 출력.",
      },
      { role: "user", content: `다음 이름들의 성별을 추정해줘: ${names.join(", ")}` },
    ],
  });
  try {
    return JSON.parse(res.choices[0].message.content ?? "{}");
  } catch {
    return {};
  }
}

async function main() {
  const dir = process.argv[2] || DEFAULT_DIR;
  const files = readdirSync(dir).filter(
    (f) => f.endsWith(".md") && !EXCLUDE_PREFIX.some((p) => f.startsWith(p))
  );
  console.log(`📄 ${files.length}개 프로필 .md 발견 (폴더: ${dir})`);

  const members = files.map((f) => parseMember(f, readFileSync(join(dir, f), "utf-8")));

  // 성별 추론
  console.log("🧭 이름 기반 성별 추론 중...");
  const genders = await inferGenders(members.map((m) => m.name));

  // 임베딩 (profile_text: 핵심 필드 + 본문)
  console.log("🧠 임베딩 생성 중...");
  const texts = members.map((m) =>
    [
      `이름:${m.name}`,
      m.major && `전공:${m.major}`,
      m.mbti && `MBTI:${m.mbti}`,
      m.tagline && `한줄소개:${m.tagline}`,
      m.skills && `스킬:${m.skills}`,
      m.interests && `관심분야:${m.interests}`,
      m.raw_text,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 6000)
  );
  const embeddings = await embedBatch(texts);
  if (embeddings[0]?.length !== EMBEDDING_DIM) {
    throw new Error(`임베딩 차원 불일치: ${embeddings[0]?.length}`);
  }

  const payload = members.map((m, i) => ({
    ...m,
    birth_year: m.birth_year ?? BIRTH_YEAR_OVERRIDES[m.name] ?? null,
    gender: genders[m.name] ?? null,
    profile_text: texts[i],
    embedding: embeddings[i],
  }));

  const supabase = supabaseAdmin();
  console.log("🗑️  기존 next_members 비우기...");
  await supabase.from("next_members").delete().neq("id", 0);
  console.log("⬆️  업로드 중...");
  const { error } = await supabase.from("next_members").insert(payload);
  if (error) throw error;

  console.log(`✅ 완료! ${payload.length}명 적재.`);
  console.table(
    payload.map((m) => ({ 이름: m.name, 성별: m.gender, 출생: m.birth_year, 전공: m.major }))
  );
}

main().catch((e) => {
  console.error("❌ 실패:", e);
  process.exit(1);
});
