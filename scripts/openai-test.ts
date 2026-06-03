/** OpenAI 키 + 성별추론 + 임베딩 동작 검증 (Supabase 불필요): npx tsx scripts/openai-test.ts */
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { openai, CHAT_MODEL, embed } from "../lib/openai";
import { parseMember, EXCLUDE_PREFIX } from "../lib/parseMember";

async function main() {
  const dir = "넥스트 정보";
  const files = readdirSync(dir).filter(
    (f) => f.endsWith(".md") && !EXCLUDE_PREFIX.some((p) => f.startsWith(p))
  );
  const names = files.map((f) => parseMember(f, readFileSync(join(dir, f), "utf-8")).name);

  console.log("🧭 성별 추론 테스트...");
  const res = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: '한국 이름의 일반적 성별을 추정한다. {"이름":"남"|"여"} JSON만 출력.' },
      { role: "user", content: `성별 추정: ${names.join(", ")}` },
    ],
  });
  const genders = JSON.parse(res.choices[0].message.content ?? "{}");
  console.table(genders);

  console.log("\n🧠 임베딩 테스트...");
  const v = await embed("리더십 있고 창업에 진심인 컴퓨터학과 학생");
  console.log(`임베딩 차원: ${v.length} (앞 3개: ${v.slice(0, 3).map((x) => x.toFixed(4)).join(", ")})`);
  console.log("\n✅ OpenAI 키 정상 동작");
}
main().catch((e) => { console.error("❌", e); process.exit(1); });
