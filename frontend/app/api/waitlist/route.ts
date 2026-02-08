import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(input: string): string {
  return input.toLowerCase().trim();
}

function isValidEmail(input: string): boolean {
  return EMAIL_REGEX.test(input);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_EMAIL",
            message: "Email query parameter is required",
          },
        },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_EMAIL",
            message: "Email format is invalid",
          },
        },
        { status: 400 }
      );
    }
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from<{ id: number }>("waitlist")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      exists: Boolean(data),
    });
  } catch (error) {
    console.error("Waitlist lookup error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Failed to check waitlist",
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email : "";
    const source =
      typeof body.source === "string" && body.source.trim() !== ""
        ? body.source.trim()
        : "landing-page";

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_EMAIL",
            message: "Email is required",
          },
        },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_EMAIL",
            message: "Email format is invalid",
          },
        },
        { status: 400 }
      );
    }
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from<{ id: number }>("waitlist")
      .insert({
        email: normalizedEmail,
        source,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "ALREADY_EXISTS",
              message: "This email is already registered.",
            },
          },
          { status: 409 }
        );
      }
      throw error;
    }

    if (!data) {
      throw new Error("Waitlist insert returned no row");
    }

    return NextResponse.json({
      success: true,
      id: data.id,
    });
  } catch (error) {
    console.error("Waitlist insert error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "Failed to add email to waitlist",
        },
      },
      { status: 500 }
    );
  }
}
