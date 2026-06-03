/** 노션 export(.md) 한 건을 구조화 필드로 파싱 (외부 의존성 없음, 순수 함수). */

export type ParsedMember = {
  name: string;
  birthday: string | null;
  birth_year: number | null;
  major: string | null;
  mbti: string | null;
  email: string | null;
  instagram: string | null;
  linkedin: string | null;
  phone: string | null;
  tagline: string | null;
  skills: string | null;
  interests: string | null;
  raw_text: string;
};

function field(text: string, label: string): string | null {
  const m = text.match(new RegExp(`^${label}:\\s*(.+)$`, "m"));
  return m ? m[1].trim() : null;
}

function section(text: string, headerRegex: RegExp): string | null {
  const m = text.match(headerRegex);
  if (!m) return null;
  const rest = text.slice(m.index! + m[0].length);
  const next = rest.search(/\n#{2,3}\s/);
  const block = (next === -1 ? rest : rest.slice(0, next)).trim();
  return block || null;
}

export function parseMember(filename: string, text: string): ParsedMember {
  const name = (text.match(/^#\s+(.+)$/m)?.[1] ?? filename).trim();
  const birthday = field(text, "생일");
  const birthYear = birthday ? parseInt(birthday.match(/\d{4}/)?.[0] ?? "", 10) : NaN;

  const majorRaw = text.match(/고려대학교[^\n]*?(?:학과|학부|전공|교육과)/)?.[0] ?? null;
  const major = majorRaw ? majorRaw.replace(/^고려대학교\s*/, "").trim() : null;

  const tagline = text.match(/^#{2,3}\s*["“](.+?)["”]/m)?.[1]?.trim() ?? null;
  const skills = section(text, /#{2,3}[^\n]*Tools\s*&\s*Skills[^\n]*\n/);
  const interests = section(text, /#{2,3}[^\n]*관심분야[^\n]*\n/);

  const raw = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim();

  return {
    name,
    birthday,
    birth_year: Number.isFinite(birthYear) ? birthYear : null,
    major,
    mbti: field(text, "MBTI"),
    email: field(text, "이메일"),
    instagram: field(text, "인스타그램"),
    linkedin: field(text, "링크드인"),
    phone: field(text, "전화번호"),
    tagline,
    skills: skills ? skills.slice(0, 1000) : null,
    interests: interests ? interests.slice(0, 1500) : null,
    raw_text: raw,
  };
}

export const EXCLUDE_PREFIX = [
  "14기 Members",
  "자기소개 템플릿",
  "운영진 Profile",
  "학회원 Profile",
];
