import { NextRequest, NextResponse } from "next/server";

import { mapBountyRow, type BountyRow } from "@/lib/supabase/models";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function errorResponse(code: string, message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    { status }
  );
}

// GET /api/bounties/:id
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("bounties")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return errorResponse("BOUNTY_NOT_FOUND", "Bounty not found", 404);
    }

    return NextResponse.json({
      success: true,
      bounty: mapBountyRow(data as BountyRow),
    });
  } catch (error) {
    console.error("Get bounty error:", error);
    return errorResponse("SERVER_ERROR", "Failed to get bounty", 500);
  }
}
