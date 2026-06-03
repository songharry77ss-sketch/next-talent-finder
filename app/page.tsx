"use client";

import { useState, useRef, useEffect } from "react";

type Member = {
  id: number;
  name: string;
  gender: string | null;
  birth_year: number | null;
  major: string | null;
  mbti: string | null;
  skills: string | null;
  interests: string | null;
  tagline: string | null;
  email: string | null;
  instagram: string | null;
  linkedin: string | null;
  similarity: number | null;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  members?: Member[];
};

const SUGGESTIONS = [
  "03년생 남자 철학과 찾아줘",
  "컴퓨터학과에서 AI에 진심인 사람",
  "리더십 있고 실행력 강한 사람",
  "디자인 잘하는 사람 추천해줘",
];

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setMessages([
        ...next,
        {
          role: "assistant",
          content: data.reply ?? data.error ?? "오류가 발생했습니다.",
          members: data.members,
        },
      ]);
    } catch {
      setMessages([...next, { role: "assistant", content: "네트워크 오류가 발생했습니다." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col px-4">
      <header className="py-5 text-center">
        <h1 className="text-xl font-bold">🧑‍💻 인재 추천 챗봇</h1>
        <p className="text-sm text-gray-500">조건을 말하면 동아리 멤버를 찾아드려요</p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <div className="mt-10 space-y-3 text-center">
            <p className="text-gray-400">예시 질문을 눌러보세요</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className={
                "inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm " +
                (m.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900")
              }
            >
              {m.content}
            </div>
            {m.members && m.members.length > 0 && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {m.members.map((mem) => (
                  <MemberCard key={mem.id} m={mem} />
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="text-left">
            <div className="inline-block rounded-2xl bg-gray-100 px-4 py-2.5 text-sm text-gray-500">
              찾는 중…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="예: 03년생 남자 철학과 찾아줘"
          className="flex-1 rounded-full border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          전송
        </button>
      </form>
    </div>
  );
}

function MemberCard({ m }: { m: Member }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-left text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{m.name}</span>
        <span className="text-xs text-gray-400">
          {[m.gender, m.birth_year && `${m.birth_year}년생`, m.mbti]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      {m.major && <div className="mt-0.5 text-xs text-gray-600">{m.major}</div>}
      {m.tagline && <p className="mt-1 text-xs italic text-gray-700">“{m.tagline}”</p>}
      {m.skills && <p className="mt-1 line-clamp-2 text-xs text-gray-500">🛠 {m.skills}</p>}
      <div className="mt-1.5 flex gap-2 text-[11px]">
        {m.instagram && (
          <a
            href={igUrl(m.instagram)}
            target="_blank"
            rel="noreferrer"
            className="text-pink-600 hover:underline"
          >
            Instagram
          </a>
        )}
        {m.linkedin && (
          <a
            href={cleanUrl(m.linkedin)}
            target="_blank"
            rel="noreferrer"
            className="text-blue-700 hover:underline"
          >
            LinkedIn
          </a>
        )}
      </div>
      {m.similarity != null && (
        <div className="mt-1 text-[10px] text-gray-400">
          관련도 {(m.similarity * 100).toFixed(0)}%
        </div>
      )}
    </div>
  );
}

function igUrl(v: string): string {
  const handle = v.replace(/^@/, "").trim();
  return handle.startsWith("http") ? handle : `https://instagram.com/${handle}`;
}

function cleanUrl(v: string): string {
  // 노션 마크다운 링크 형태 "[url](url)" 정리
  const m = v.match(/\(([^)]+)\)/);
  return (m ? m[1] : v).trim();
}
