-- ============================================================
-- 인재 추천 서비스 — Supabase 스키마 (NEXT 14기 .md 데이터)
-- ※ 기존 프로젝트(girigo-v2) 재사용: 운영 테이블과 충돌하지 않도록
--   전용 테이블명 next_members / 함수명 search_next_members 사용.
--   파괴적 drop 없음. Supabase 대시보드 > SQL Editor 에 붙여넣고 Run.
-- ============================================================

-- 1) pgvector 확장
create extension if not exists vector;

-- 2) next_members 테이블 (없을 때만 생성)
create table if not exists next_members (
  id          bigint generated always as identity primary key,
  name        text not null,
  gender      text,                 -- '남'/'여' (이름 기반 추론값)
  birth_year  int,                  -- 생일에서 추출 (예: 2003)
  birthday    text,                 -- 원본 생일 (예: 2003/12/01)
  major       text,                 -- 학력 본문에서 파싱한 전공/학과
  mbti        text,
  skills      text,
  interests   text,
  tagline     text,
  email       text,
  instagram   text,
  linkedin    text,
  phone       text,
  raw_text    text,                 -- 자기소개 .md 전문
  profile_text text,                -- 임베딩에 사용된 텍스트
  embedding   vector(1536),
  created_at  timestamptz default now()
);

-- 구조화 필터용 보조 인덱스
create index if not exists next_members_birth_year_idx on next_members (birth_year);
create index if not exists next_members_gender_idx on next_members (gender);
-- (데이터가 27건으로 적어 벡터 인덱스(ivfflat) 없이 정확검색을 사용 — 더 정확)

-- ============================================================
-- 3) 통합 검색 함수: 구조화 필터 + 선택적 의미검색(임베딩)
--    query_embedding 이 null 이면 순수 필터 검색.
-- ============================================================
create or replace function search_next_members(
  query_embedding vector(1536) default null,
  filter_gender     text default null,
  filter_birth_year int  default null,
  filter_year_min   int  default null,
  filter_year_max   int  default null,
  filter_major      text default null,
  filter_mbti       text default null,
  filter_keyword    text default null,
  match_count       int  default 5
)
returns table (
  id bigint, name text, gender text, birth_year int, major text,
  mbti text, skills text, interests text, tagline text,
  email text, instagram text, linkedin text, similarity float
)
language sql stable
as $$
  select
    m.id, m.name, m.gender, m.birth_year, m.major, m.mbti,
    m.skills, m.interests, m.tagline, m.email, m.instagram, m.linkedin,
    case when query_embedding is null then null
         else 1 - (m.embedding <=> query_embedding) end as similarity
  from next_members m
  where
    (filter_gender     is null or m.gender = filter_gender)
    and (filter_birth_year is null or m.birth_year = filter_birth_year)
    and (filter_year_min   is null or m.birth_year >= filter_year_min)
    and (filter_year_max   is null or m.birth_year <= filter_year_max)
    and (filter_major      is null or m.major ilike '%' || filter_major || '%')
    and (filter_mbti       is null or m.mbti ilike filter_mbti)
    and (filter_keyword    is null or m.raw_text ilike '%' || filter_keyword || '%')
  order by
    case when query_embedding is null then 0
         else (m.embedding <=> query_embedding) end asc,
    m.name asc
  limit match_count;
$$;
