import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicOrigin } from "@/lib/url/origin";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const origin = getPublicOrigin(request);

  if (!email || !password) {
    return NextResponse.redirect(`${origin}/login?error=missing`, { status: 303 });
  }

  // Build a response first, then create the client that writes cookies to it
  const response = NextResponse.redirect(`${origin}/home`, { status: 303 });
  const errorResponse = () => NextResponse.redirect(`${origin}/login?error=invalid`, { status: 303 });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Read from incoming request cookies
          const cookieHeader = request.headers.get("cookie") ?? "";
          return cookieHeader.split(";").filter(Boolean).map((c) => {
            const [name, ...rest] = c.trim().split("=");
            return { name, value: rest.join("=") };
          });
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            const isProduction = process.env.NODE_ENV === "production";
            response.cookies.set(name, value, {
              ...options,
              domain: undefined,
              sameSite: "lax",
              path: "/",
              secure: isProduction,
              httpOnly: true,
            });
          }
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return errorResponse();
  }

  return response;
}
