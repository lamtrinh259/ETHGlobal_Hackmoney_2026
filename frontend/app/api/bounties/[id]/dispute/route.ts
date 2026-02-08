import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";

import { type BountyRow } from "@/lib/supabase/models";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { DisputeInput } from "@/lib/types/bounty";

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

// POST /api/bounties/:id/dispute - Open a dispute
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body: DisputeInput = await request.json();
    const initiatorAddress = body.initiatorAddress;
    const reason = body.reason;

    if (!initiatorAddress || !isAddress(initiatorAddress)) {
      return errorResponse("INVALID_ADDRESS", "Valid initiator address required");
    }

    if (!reason || reason.trim().length === 0) {
      return errorResponse("INVALID_REASON", "Dispute reason required");
    }

    const supabase = getSupabaseServerClient();
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

    const disputeAllowedStatuses = ["CLAIMED", "SUBMITTED"];
    if (!disputeAllowedStatuses.includes(bounty.status)) {
      return errorResponse(
        "INVALID_STATUS_FOR_DISPUTE",
        `Cannot dispute bounty with status: ${bounty.status}`
      );
    }

    const initiatorLower = initiatorAddress.toLowerCase();
    const isPoster = bounty.poster_address === initiatorLower;
    const isAgent = bounty.assigned_agent_address === initiatorLower;

    if (!isPoster && !isAgent) {
      return errorResponse(
        "NOT_PARTICIPANT",
        "Only the poster or assigned agent can open a dispute",
        403
      );
    }

    if (bounty.dispute_status === "PENDING") {
      return errorResponse(
        "ALREADY_DISPUTED",
        "A dispute is already pending for this bounty"
      );
    }

    const now = Date.now();
    const disputeId = `dispute_${id}_${now}`;

    const { error: bountyUpdateError } = await supabase
      .from<BountyRow>("bounties")
      .update({
        dispute_status: "PENDING",
        dispute_reason: reason.trim(),
        dispute_timestamp: now,
        dispute_initiator: initiatorLower,
        dispute_id: disputeId,
      })
      .eq("id", id);

    if (bountyUpdateError) {
      throw bountyUpdateError;
    }

    const { error: disputeInsertError } = await supabase.from("disputes").insert({
      id: disputeId,
      bounty_id: id,
      agent_id: bounty.assigned_agent_id,
      poster_address: bounty.poster_address,
      reason: reason.trim(),
      evidence_cid: null,
      status: "PENDING",
      created_at: now,
    });

    if (disputeInsertError) {
      throw disputeInsertError;
    }

    return NextResponse.json({
      success: true,
      disputeId,
      message:
        "Dispute opened. This will be reviewed by the Clawork team and settled through Yellow flow.",
    });
  } catch (error) {
    console.error("Open dispute error:", error);
    return errorResponse("SERVER_ERROR", "Failed to open dispute", 500);
  }
}
