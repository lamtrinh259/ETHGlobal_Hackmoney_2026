import { NextRequest, NextResponse } from "next/server";

import {
  DEFAULT_REPUTATION,
  normalizeReputation,
  type AgentRow,
  type BountyRow,
} from "@/lib/supabase/models";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { closeChannel, MOCK_MODE, updateAllocation } from "@/lib/services/yellow";

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

// POST /api/bounties/:id/approve
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const posterAddress =
      typeof body.posterAddress === "string" ? body.posterAddress : "";
    const approved = Boolean(body.approved);
    const rating = typeof body.rating === "number" ? body.rating : undefined;
    const comment = typeof body.comment === "string" ? body.comment : undefined;

    if (!posterAddress) {
      return errorResponse("INVALID_POSTER", "Poster address required");
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

    if (bounty.status !== "SUBMITTED") {
      return errorResponse(
        "INVALID_STATUS",
        "Bounty must be submitted to approve"
      );
    }

    if (bounty.poster_address !== posterAddress.toLowerCase()) {
      return errorResponse("NOT_POSTER", "Only the poster can approve this bounty", 403);
    }

    if (approved) {
      let settlementTxHash: string | null = null;

      if (bounty.yellow_channel_id && bounty.assigned_agent_address) {
        try {
          console.log(
            `[Approve] Processing payment for bounty ${id} via Yellow channel ${bounty.yellow_channel_id}`
          );
          console.log(`[Approve] Mode: ${MOCK_MODE ? "MOCK" : "PRODUCTION"}`);

          await updateAllocation(bounty.yellow_channel_id, {
            [bounty.assigned_agent_address]: Number(bounty.reward),
            [bounty.poster_address]: 0,
          });

          const { txHash } = await closeChannel(bounty.yellow_channel_id);
          settlementTxHash = txHash || null;
        } catch (paymentError) {
          console.error(
            `[Approve] Payment settlement failed for bounty ${id}:`,
            paymentError
          );
        }
      } else {
        console.warn(`[Approve] Missing channel or assigned agent for bounty ${id}`);
      }

      const { error: bountyUpdateError } = await supabase
        .from<BountyRow>("bounties")
        .update({
          status: "COMPLETED",
          completed_at: Date.now(),
          settlement_tx_hash: settlementTxHash,
        })
        .eq("id", id);

      if (bountyUpdateError) {
        throw bountyUpdateError;
      }

      if (bounty.assigned_agent_id) {
        const { data: agentData, error: agentError } = await supabase
          .from<AgentRow>("agents")
          .select("*")
          .eq("id", bounty.assigned_agent_id)
          .maybeSingle();

        if (agentError) {
          throw agentError;
        }

        if (agentData) {
          const agent = agentData as AgentRow;
          const reputation = normalizeReputation(agent.reputation);
          const feedbackHistory = Array.isArray(agent.feedback_history)
            ? [...agent.feedback_history]
            : [];

          const ratingValue = rating || 5;
          const scoreIncrement = (ratingValue - 3) * 0.1;

          const nextReputation = {
            score: reputation.score + scoreIncrement,
            totalJobs: reputation.totalJobs + 1,
            positive: reputation.positive + (ratingValue >= 3 ? 1 : 0),
            negative: reputation.negative + (ratingValue < 3 ? 1 : 0),
            confidence:
              reputation.totalJobs + 1 > 0
                ? Math.min(1, (reputation.totalJobs + 1) / 10)
                : DEFAULT_REPUTATION.confidence,
          };

          feedbackHistory.push({
            bountyId: id,
            bountyTitle: bounty.title,
            rating: ratingValue,
            comment: comment || "",
            posterAddress: posterAddress.toLowerCase(),
            timestamp: Date.now(),
          });

          const { error: agentUpdateError } = await supabase
            .from<AgentRow>("agents")
            .update({
              reputation: nextReputation,
              feedback_history: feedbackHistory,
              updated_at: Date.now(),
            })
            .eq("id", bounty.assigned_agent_id);

          if (agentUpdateError) {
            throw agentUpdateError;
          }
        }
      }

      return NextResponse.json({
        success: true,
        status: "COMPLETED",
        message: "Work approved! Payment released to agent.",
      });
    }

    const { error: rejectError } = await supabase
      .from<BountyRow>("bounties")
      .update({
        status: "REJECTED",
        completed_at: Date.now(),
      })
      .eq("id", id);

    if (rejectError) {
      throw rejectError;
    }

    return NextResponse.json({
      success: true,
      status: "REJECTED",
      message: "Work rejected. Bounty marked as rejected.",
    });
  } catch (error) {
    console.error("Approve bounty error:", error);
    return errorResponse("SERVER_ERROR", "Failed to process approval", 500);
  }
}
