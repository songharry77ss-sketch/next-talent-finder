/** 파싱 단독 검증 (API/DB 불필요): npm run parse-test */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseMember, EXCLUDE_PREFIX } from "../lib/parseMember";

const dir = process.argv[2] || "넥스트 정보";
const files = readdirSync(dir).filter(
  (f) => f.endsWith(".md") && !EXCLUDE_PREFIX.some((p) => f.startsWith(p))
);

const rows = files.map((f) => {
  const m = parseMember(f, readFileSync(join(dir, f), "utf-8"));
  return {
    이름: m.name,
    출생: m.birth_year ?? "?",
    전공: m.major ?? "(파싱실패)",
    MBTI: m.mbti ?? "?",
    스킬있음: m.skills ? "O" : "X",
  };
});

console.log(`총 ${rows.length}명\n`);
console.table(rows);

const noMajor = rows.filter((r) => r.전공 === "(파싱실패)");
const noYear = rows.filter((r) => r.출생 === "?");
console.log(`\n전공 파싱 실패: ${noMajor.length}명`, noMajor.map((r) => r.이름));
console.log(`출생연도 파싱 실패: ${noYear.length}명`, noYear.map((r) => r.이름));
