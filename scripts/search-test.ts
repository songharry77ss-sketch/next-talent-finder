/** search_next_members 직접 검증: npx tsx scripts/search-test.ts */
import { supabaseAdmin } from "../lib/supabase";
import { embed } from "../lib/openai";

async function main() {
  const supabase = supabaseAdmin();

  console.log("① 구조화 필터: 03년생(2003) 남자 철학과");
  const { data: a, error: ea } = await supabase.rpc("search_next_members", {
    filter_gender: "남",
    filter_birth_year: 2003,
    filter_major: "철학",
    match_count: 5,
  });
  if (ea) throw ea;
  console.log("  →", (a ?? []).map((m: { name: string; major: string }) => `${m.name}(${m.major})`).join(", ") || "(없음)");

  console.log("\n② 의미검색: 'AI 에이전트 개발에 진심인 사람'");
  const v = await embed("AI 에이전트 개발에 진심이고 창업 의지가 강한 개발자");
  const { data: b, error: eb } = await supabase.rpc("search_next_members", {
    query_embedding: v,
    match_count: 3,
  });
  if (eb) throw eb;
  for (const m of b ?? []) {
    console.log(`  → ${m.name} (${m.major}) 관련도 ${(m.similarity * 100).toFixed(0)}%`);
  }

  console.log("\n③ 혼합: 컴퓨터학과 + 의미검색(머신러닝/AI)");
  const v2 = await embed("머신러닝과 AI 연구에 깊은 관심");
  const { data: c, error: ec } = await supabase.rpc("search_next_members", {
    query_embedding: v2,
    filter_major: "컴퓨터",
    match_count: 3,
  });
  if (ec) throw ec;
  for (const m of c ?? []) {
    console.log(`  → ${m.name} (${m.major}) 관련도 ${(m.similarity * 100).toFixed(0)}%`);
  }
}
main().catch((e) => { console.error("❌", e); process.exit(1); });
