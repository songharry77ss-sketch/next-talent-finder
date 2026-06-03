/** Supabase 연결 + next_members 존재 확인: npx tsx scripts/db-test.ts */
import { supabaseAdmin } from "../lib/supabase";

async function main() {
  const supabase = supabaseAdmin();

  const { count, error } = await supabase
    .from("next_members")
    .select("*", { count: "exact", head: true });

  if (error) {
    if (/does not exist|schema cache|relation/i.test(error.message)) {
      console.log("⚠️  연결은 OK. 단, next_members 테이블이 아직 없습니다.");
      console.log("   → Supabase SQL Editor 에서 supabase/schema.sql 을 실행하세요.");
      console.log("   (원본 오류: " + error.message + ")");
      return;
    }
    throw error;
  }
  console.log(`✅ 연결 OK. next_members 행 수: ${count}`);

  const { error: rpcErr } = await supabase.rpc("search_next_members", { match_count: 1 });
  console.log(
    rpcErr
      ? `⚠️  search_next_members 함수 없음 → schema.sql 실행 필요 (${rpcErr.message})`
      : "✅ search_next_members 함수 정상"
  );
}
main().catch((e) => { console.error("❌", e); process.exit(1); });
