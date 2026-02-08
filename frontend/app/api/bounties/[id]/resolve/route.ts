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

// POST /api/bounties/:id/resolve - Resolve a dispute
// Settles the Yellow channel based on the decision and updates reputation
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const decision = typeof body.decision === "string" ? body.decision : "";
    const reviewNotes = typeof body.reviewNotes === "string" ? body.reviewNotes : "";

    if (!decision || !["agent", "poster"].includes(decision)) {
      return errorResponse(
        "INVALID_DECISION",
        'Decision must be "agent" or "poster"'
      );
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

    if (bounty.dispute_status !== "PENDING") {
      return errorResponse(
        "NO_PENDING_DISPUTE",
        "No pending dispute to resolve for this bounty"
      );
    }

    // Settle via Yellow state channel
    let settlementTxHash: string | null = null;
    let yellowMode: "mock" | "production" = MOCK_MODE ? "mock" : "production";

    if (bounty.yellow_channel_id && bounty.assigned_agent_address) {
      try {
        console.log(
          `[Resolve] Settling dispute for bounty ${id} in favor of: ${decision}`
        );

        // Update allocation based on decision
        const allocation: Record<string, number> =
          decision === "agent"
            ? {
                [bounty.assigned_agent_address]: Number(bounty.reward),
                [bounty.poster_address]: 0,
              }
            : {
                [bounty.assigned_agent_address]: 0,
                [bounty.poster_address]: Number(bounty.reward),
              };

        await updateAllocation(bounty.yellow_channel_id, allocation);

        const closeResult = await closeChannel(bounty.yellow_channel_id);
        settlementTxHash = closeResult.txHash || null;
        yellowMode = closeResult.mode;

        console.log(
          `[Resolve] Channel settled (${yellowMode}): ${settlementTxHash}`
        );
      } catch (settlementError) {
        console.error(
          `[Resolve] Settlement failed for bounty ${id}:`,
          settlementError
        );
      }
    }

    // Update bounty status
    const now = Date.now();
    const newStatus = decision === "agent" ? "COMPLETED" : "REJECTED";

    const { error: bountyUpdateError } = await supabase
      .from<BountyRow>("bounties")
      .update({
        status: newStatus,
        dispute_status: "RESOLVED",
        completed_at: now,
        settlement_tx_hash: settlementTxHash,
      })
      .eq("id", id);

    if (bountyUpdateError) {
      throw bountyUpdateError;
    }

    // Update dispute record
    if (bounty.dispute_id) {
      const { error: disputeUpdateError } = await supabase
        .from("disputes")
        .update({
          status: "RESOLVED",
          decision,
          review_notes: reviewNotes || null,
          resolved_at: now,
        })
        .eq("id", bounty.dispute_id);

      if (disputeUpdateError) {
        console.error("Failed to update dispute record:", disputeUpdateError);
      }
    }

    // Update agent reputation based on outcome
    if (bounty.assigned_agent_id) {
      const { data: agentData, error: agentError } = await supabase
        .from<AgentRow>("agents")
        .select("*")
        .eq("id", bounty.assigned_agent_id)
        .maybeSingle();

      if (!agentError && agentData) {
        const agent = agentData as AgentRow;
        const reputation = normalizeReputation(agent.reputation);
        const feedbackHistory = Array.isArray(agent.feedback_history)
          ? [...agent.feedback_history]
          : [];

        const nextReputation =
          decision === "agent"
            ? {
                // Agent wins dispute: count as completed job
                score: reputation.score + 0.1,
                totalJobs: reputation.totalJobs + 1,
                positive: reputation.positive + 1,
                negative: reputation.negative,
                confidence: Math.min(1, (reputation.totalJobs + 1) / 10),
              }
            : {
                // Agent loses dispute: negative mark
                score: Math.max(0, reputation.score - 0.5),
                totalJobs: reputation.totalJobs,
                positive: reputation.positive,
                negative: reputation.negative + 1,
                confidence: reputation.confidence,
              };

        feedbackHistory.push({
          bountyId: id,
          bountyTitle: bounty.title,
          rating: decision === "agent" ? 4 : 1,
          comment: `Dispute resolved in favor of ${decision}. ${reviewNotes}`.trim(),
          posterAddress: "system",
          timestamp: now,
        });

        await supabase
          .from<AgentRow>("agents")
          .update({
            reputation: nextReputation,
            feedback_history: feedbackHistory,
            updated_at: now,
          })
          .eq("id", bounty.assigned_agent_id);
      }
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
      decision,
      disputeStatus: "RESOLVED",
      settlementTxHash,
      yellowMode,
      message: `Dispute resolved in favor of ${decision}. ${
        decision === "agent"
          ? "Payment released to agent."
          : "Funds returned to poster."
      }`,
    });
  } catch (error) {
    console.error("Resolve dispute error:", error);
    return errorResponse("SERVER_ERROR", "Failed to resolve dispute", 500);
  }
}
