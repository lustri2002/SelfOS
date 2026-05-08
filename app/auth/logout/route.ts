import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicOrigin } from "@/lib/url/origin";

async function logout(request: Request) {
  const origin = getPublicOrigin(request);
  const response = NextResponse.redirect(`${origin}/login`, { status: 303 });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookieHeader = request.headers.get("cookie") ?? "";
          return cookieHeader.split(";").filter(Boolean).map((cookie) => {
            const [name, ...rest] = cookie.trim().split("=");
            return { name, value: rest.join("=") };
          });
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, {
              ...options,
              domain: undefined,
              path: "/",
              secure: process.env.NODE_ENV === "production",
              httpOnly: true,
              sameSite: "lax",
            });
          }
        },
      },
    }
  );

  await supabase.auth.signOut();

  return response;
}

export async function GET(request: Request) {
  return logout(request);
}

export async function POST(request: Request) {
  return logout(request);
}
