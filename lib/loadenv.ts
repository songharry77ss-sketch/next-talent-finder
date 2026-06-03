// 부수효과 전용 모듈: import 되는 즉시 .env.local 을 로드한다.
// lib/openai, lib/supabase 의 첫 import 로 두면, 이 모듈이 먼저 평가되어
// 스크립트(tsx)에서도 환경변수가 클라이언트 생성 전에 채워진다.
// (Next.js 런타임은 .env.local 을 자동 로드하므로 여기선 사실상 no-op)
import { config } from "dotenv";

config({ path: ".env.local" });
config(); // .env 도 보조로
