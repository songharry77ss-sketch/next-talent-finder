/** 모델이 추출하는 필터 인자 확인: npx tsx scripts/toolcall-test.ts */
import { openai } from "../lib/openai";

const tools = [
  {
    type: "function" as const,
    function: {
      name: "search_members",
      description: "조건에 맞는 멤버 검색. 사용자가 말한 모든 조건을 해당 필터에 반영.",
      parameters: {
        type: "object",
        properties: {
          filter_gender: { type: "string", enum: ["남", "여"] },
          filter_birth_year: { type: "integer" },
          filter_major: { type: "string" },
          filter_mbti: { type: "string" },
          filter_keyword: { type: "string" },
          semantic_query: { type: "string" },
        },
      },
    },
  },
];

async function ask(model: string, q: string) {
  const r = await openai.chat.completions.create({
    model,
    temperature: 0,
    tools,
    tool_choice: "auto",
    messages: [
      { role: "system", content: "사용자가 말한 조건을 빠짐없이 search_members 필터에 반영하라." },
      { role: "user", content: q },
    ],
  });
  const tc = r.choices[0].message.tool_calls?.[0];
  console.log(`[${model}] "${q}"`);
  console.log("  →", tc && tc.type === "function" ? tc.function.arguments : "(툴콜 없음): " + r.choices[0].message.content);
}

async function main() {
  for (const m of ["gpt-4o-mini", "gpt-4o"]) {
    await ask(m, "03년생 남자 철학과 찾아줘");
  }
}
main().catch((e) => { console.error("❌", e); process.exit(1); });
