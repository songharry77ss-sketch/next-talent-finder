import "./loadenv";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL 가 설정되지 않았습니다.");

/** 서버 라우트/스크립트 전용: service_role 키로 RLS 우회. 절대 클라이언트로 내보내지 말 것. */
export function supabaseAdmin() {
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다.");
  return createClient(url!, serviceKey, {
    auth: { persistSession: false },
  });
}

/** 읽기 전용 클라이언트 (anon). */
export function supabasePublic() {
  if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY 가 설정되지 않았습니다.");
  return createClient(url!, anonKey, {
    auth: { persistSession: false },
  });
}
