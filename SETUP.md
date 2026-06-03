# 인재 추천 챗봇 — 셋업 가이드

조건(예: "여자 02년생", "리더십 있는 디자이너")을 입력하면 동아리 멤버를 찾아주는 챗봇.
**Next.js + Supabase(pgvector) + OpenAI(Tool Calling + RAG)** 구조.

## 아키텍처

```
질문 → GPT가 분석(Tool Calling)
        ├─ 정확한 조건(성별/나이/전공) → SQL 필터
        └─ 추상적 조건(리더십/창의성)  → pgvector 의미 검색
      → 후보 멤버 → GPT가 추천 답변 생성 → 채팅 UI
```

데이터: 노션 export 폴더 `넥스트 정보/` 의 사람별 `.md`. 각 파일에 생일·MBTI·연락처
+ 학력·스킬·관심사·자기소개 본문이 들어있어, 본문 전체를 임베딩해 RAG로 검색한다.

핵심 파일:
- `supabase/schema.sql` — 테이블 + 벡터 인덱스 + `search_members` 함수
- `lib/parseMember.ts` — .md → 구조화 필드 파서 (전공/MBTI/생일 등 추출)
- `scripts/import.ts` — .md 파싱 → 성별 추론(GPT) → 전문 임베딩 → DB 적재
- `scripts/parse-test.ts` — 파싱만 단독 검증 (API/DB 불필요)
- `app/api/chat/route.ts` — Tool Calling 루프 (시스템 프롬프트 여기 있음)
- `app/page.tsx` — 채팅 UI
- `lib/openai.ts`, `lib/supabase.ts` — 클라이언트

> ⚠️ 데이터에 **성별 칼럼이 없어** 이름 기반으로 GPT가 추정합니다(부정확할 수 있음).
> 생일이 비어있는 멤버(배상일·안지한·조혜진)는 출생연도가 null 입니다.

---

## 1. 환경변수 설정

`.env.local.example` 를 복사해 `.env.local` 로 만들고 값을 채웁니다.

```
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

- OpenAI 키: https://platform.openai.com/api-keys
- Supabase 값: 프로젝트 > **Settings > API** (URL, anon, service_role)

## 2. Supabase 스키마 생성

1. https://supabase.com 에서 프로젝트 생성
2. 좌측 **SQL Editor** 열기
3. `supabase/schema.sql` 내용을 붙여넣고 **Run**

## 3. 데이터 임포트 (노션 .md)

먼저 파싱이 잘 되는지 API 없이 확인:

```bash
npm run parse-test       # 27명 추출 결과 표로 출력
```

실제 적재 (임베딩 생성 + 성별 추론 + DB 업로드, OpenAI 키 필요):

```bash
npm run import           # 기본 폴더 "넥스트 정보"
npm run import -- "다른폴더"
```

## 4. 로컬 실행

```bash
npm run dev
```

→ http://localhost:3000 에서 "여자 02년생 찾아줘" 등으로 테스트.

## 5. Vercel 배포

1. GitHub에 푸시
2. https://vercel.com → New Project → 저장소 선택
3. **Environment Variables** 에 `.env.local` 의 4개 키를 그대로 추가
4. Deploy

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` 는 서버 전용 비밀키입니다. 절대 클라이언트 코드/깃에 노출 금지
> (`.env.local` 은 `.gitignore` 에 의해 커밋되지 않습니다).
