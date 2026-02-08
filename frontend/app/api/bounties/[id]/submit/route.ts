import { NextRequest, NextResponse } from "next/server";

import { type BountyRow } from "@/lib/supabase/models";
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

// POST /api/bounties/:id/submit
export async function POST(request: NextRequest, context: RouteContext) {
  // Route-level timeout to prevent Vercel from hanging
  const ROUTE_TIMEOUT_MS = 8000;
  const timeoutController = new AbortController();
  const routeTimer = setTimeout(() => timeoutController.abort(), ROUTE_TIMEOUT_MS);

  try {
    const { id } = await context.params;
    const body = await request.json();

    const agentId = typeof body.agentId === "string" ? body.agentId : "";
    const deliverableCID =
      typeof body.deliverableCID === "string" ? body.deliverableCID : null;
    const message = typeof body.message === "string" ? body.message : null;

    if (!agentId) {
      return errorResponse("INVALID_AGENT", "Agent ID required");
    }

    if (!deliverableCID && !message) {
      return errorResponse(
        "INVALID_DELIVERABLE",
        "Deliverable CID or message required"
      );
    }

    const supabase = getSupabaseServerClient();

    console.log(`[Submit] Fetching bounty ${id}...`);
    const { data: bounty, error: bountyError } = await supabase
      .from<BountyRow>("bounties")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (bountyError) {
      throw bountyError;
    }

    if (!bounty) {
      return errorResponse("BOUNTY_NOT_FOUND", "Bounty not found", 404);
    }

    if (bounty.status !== "CLAIMED") {
      return errorResponse(
        "INVALID_STATUS",
        "Bounty must be claimed to submit work"
      );
    }

    if (bounty.assigned_agent_id !== agentId) {
      return errorResponse("NOT_ASSIGNED", "You are not assigned to this bounty", 403);
    }

    if (bounty.submit_deadline && Date.now() > bounty.submit_deadline) {
      return errorResponse("DEADLINE_PASSED", "Submit deadline has passed");
    }

    const reviewDeadline = Date.now() + 24 * 60 * 60 * 1000;

    console.log(`[Submit] Updating bounty ${id} to SUBMITTED...`);
    const { error: updateError } = await supabase
      .from<BountyRow>("bounties")
      .update({
        status: "SUBMITTED",
        deliverable_cid: deliverableCID || null,
        deliverable_message: message || null,
        submitted_at: Date.now(),
        review_deadline: reviewDeadline,
      })
      .eq("id", id);

    if (updateError) {
      throw updateError;
    }

    console.log(`[Submit] Bounty ${id} successfully submitted`);
    return NextResponse.json({
      success: true,
      reviewDeadline,
      message: "Work submitted! Poster has 24 hours to review.",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.error(`[Submit] Route timed out after ${ROUTE_TIMEOUT_MS}ms`);
      return errorResponse("TIMEOUT", "Submit request timed out", 504);
    }
    console.error("Submit work error:", error);
    return errorResponse("SERVER_ERROR", "Failed to submit work", 500);
  } finally {
    clearTimeout(routeTimer);
  }
}
