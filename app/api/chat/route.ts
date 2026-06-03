import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { openai, CHAT_MODEL, embed } from "@/lib/openai";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

// ---- 시스템 프롬프트 (5번: 커스터마이징 포인트) ----
const SYSTEM_PROMPT = `당신은 고려대학교 창업학회 NEXT 14기 멤버 인재 추천 도우미입니다.
사용자가 원하는 조건의 사람을 찾아 추천하는 것이 임무입니다.

규칙:
- 사람을 찾으려면 반드시 search_members 도구를 호출해 실제 DB에서 조회하세요. 절대 멤버를 지어내지 마세요.
- ★절대규칙★ DB(도구 결과)에 있는 값만 사용하세요. 특히 birth_year(출생연도)가 null/없음이면
  절대 추측해서 "○○년생"이라고 말하지 마세요. 대신 "출생연도 정보 없음"이라고 명시하세요.
  major, mbti 등 다른 필드도 null이면 지어내지 말고 "정보 없음"으로 처리하세요.
- ★중요★ 사용자가 말한 조건은 하나도 빠짐없이 모두 해당 필터에 반영하세요.
  예) "03년생 남자 철학과" → filter_birth_year=2003, filter_gender=남, filter_major=철학 (셋 다 필수).
  전공/학과가 언급되면 filter_major 를 절대 생략하지 마세요. 조건을 임의로 완화하지 마세요.
- "남자", "03년생", "철학과" 같은 정확한 조건은 구조화 필터(filter_*)로 넘기세요.
  · 성별: '남' 또는 '여' (※ 데이터에 성별 칼럼이 없어 이름 기반 추정값입니다)
  · "03년생"/"03년"/"2003년생" → filter_birth_year=2003
  · "20대 초반", "어린 사람" 같은 범위는 filter_year_min/filter_year_max 로 변환
  · 전공("철학과","컴공" 등) → filter_major, MBTI → filter_mbti, 특정 스킬/키워드 → filter_keyword
- "리더십 있는", "창의적인", "협업 잘하는", "AI에 진심인" 같은 추상적/주관적 조건은 semantic_query 에 자연어로 넣으세요.
- 조건이 섞이면(예: "AI에 관심 많은 남자 컴공") 구조화 필터 + semantic_query 를 함께 사용하세요.
- 결과를 친근한 한국어로 정리하고, 각 추천 인물마다 이름·전공·핵심 강점을 1~2줄로 요약하세요.
- 성별로 필터링한 경우, 추정값이라 부정확할 수 있음을 한 번 가볍게 안내하세요.
- 결과가 없으면 솔직히 없다고 말하고 조건을 완화해보라고 제안하세요.
- 사용자가 특정 인물을 물으면("조형식 어떤 사람이야?", "○○ 소개해줘") get_member_profile 로 그 사람의
  자기소개 전문을 가져온 뒤, 핵심을 자연스럽게 정리해 답하세요. 권장 구성:
  ① 한 줄 인상 ② 전공·학력·경력 ③ 스킬/강점 ④ 관심분야 ⑤ 창업/성장 포부.
  프로필에 없는 내용은 지어내지 말고, 딱딱한 표 나열 대신 사람을 소개하듯 서술하세요.`;

// ---- 툴 정의 ----
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_members",
      description:
        "조건에 맞는 동아리 멤버를 DB에서 검색한다. 정확한 조건은 filter_*, 추상적 조건은 semantic_query 사용.",
      parameters: {
        type: "object",
        properties: {
          filter_gender: { type: "string", enum: ["남", "여"], description: "성별" },
          filter_birth_year: { type: "integer", description: "정확한 출생연도 (예: 2002)" },
          filter_year_min: { type: "integer", description: "출생연도 하한(이상)" },
          filter_year_max: { type: "integer", description: "출생연도 상한(이하)" },
          filter_major: { type: "string", description: "전공/학과 키워드 (부분일치, 예: '철학', '컴퓨터')" },
          filter_mbti: { type: "string", description: "MBTI (예: 'ENTP')" },
          filter_keyword: { type: "string", description: "스킬/관심사/프로필 전문 어디든 부분일치 (예: 'Python', '로봇')" },
          semantic_query: {
            type: "string",
            description: "추상적·주관적 조건의 자연어 설명 (예: '리더십 있고 협업 잘하는 사람')",
          },
          match_count: { type: "integer", description: "최대 결과 수 (기본 5)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_member_profile",
      description:
        "특정 멤버 한 명의 자기소개 전문(학력/경력/스킬/관심사/창업포부 등)을 가져온다. " +
        "사용자가 '○○이 어떤 사람이야?', '○○ 소개해줘'처럼 특정 인물을 물어볼 때 사용.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "멤버 이름 (예: '조형식')" },
        },
        required: ["name"],
      },
    },
  },
];

type SearchArgs = {
  filter_gender?: string;
  filter_birth_year?: number;
  filter_year_min?: number;
  filter_year_max?: number;
  filter_major?: string;
  filter_mbti?: string;
  filter_keyword?: string;
  semantic_query?: string;
  match_count?: number;
};

async function runSearch(args: SearchArgs) {
  const supabase = supabaseAdmin();
  let queryEmbedding: number[] | null = null;
  if (args.semantic_query && args.semantic_query.trim()) {
    queryEmbedding = await embed(args.semantic_query);
  }

  const { data, error } = await supabase.rpc("search_next_members", {
    query_embedding: queryEmbedding,
    filter_gender: args.filter_gender ?? null,
    filter_birth_year: args.filter_birth_year ?? null,
    filter_year_min: args.filter_year_min ?? null,
    filter_year_max: args.filter_year_max ?? null,
    filter_major: args.filter_major ?? null,
    filter_mbti: args.filter_mbti ?? null,
    filter_keyword: args.filter_keyword ?? null,
    match_count: args.match_count ?? 5,
  });

  if (error) throw error;
  return data ?? [];
}

/** 특정 멤버 한 명의 전문(raw_text 포함)을 조회 */
async function runGetProfile(name: string) {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("next_members")
    .select(
      "id,name,gender,birth_year,major,mbti,skills,interests,tagline,email,instagram,linkedin,raw_text"
    )
    .ilike("name", `%${name}%`)
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

/** UI 카드용으로 무거운 raw_text 제거 */
function toCard(m: Record<string, unknown> | null) {
  if (!m) return null;
  const { raw_text: _omit, ...rest } = m;
  void _omit;
  return rest;
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = (await req.json()) as {
      messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
    };

    const convo: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    let matchedMembers: unknown[] = [];

    // 최대 3턴까지 툴 호출 루프
    for (let turn = 0; turn < 3; turn++) {
      const completion = await openai.chat.completions.create({
        model: CHAT_MODEL,
        messages: convo,
        tools,
        tool_choice: "auto",
        temperature: 0,
      });

      const msg = completion.choices[0].message;
      convo.push(msg);

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        // 최종 답변
        return NextResponse.json({ reply: msg.content ?? "", members: matchedMembers });
      }

      // 툴 실행 (이름으로 분기)
      for (const call of msg.tool_calls) {
        if (call.type !== "function") continue;
        let result: unknown = [];
        try {
          const args = JSON.parse(call.function.arguments || "{}");
          if (call.function.name === "get_member_profile") {
            const profile = await runGetProfile(String(args.name ?? ""));
            result = profile ?? { error: "해당 이름의 멤버를 찾지 못함" };
            if (profile) matchedMembers = [toCard(profile)];
          } else {
            const rows = await runSearch(args as SearchArgs);
            result = rows;
            matchedMembers = rows;
          }
        } catch (e) {
          result = { error: String(e) };
        }
        convo.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    // 루프 소진 시 마지막 한 번 더 정리 답변 요청
    const final = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: convo,
      temperature: 0,
    });
    return NextResponse.json({
      reply: final.choices[0].message.content ?? "",
      members: matchedMembers,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
