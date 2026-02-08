import { NextRequest, NextResponse } from "next/server";

import {
  normalizeReputation,
  type AgentRow,
  type BountyRow,
} from "@/lib/supabase/models";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { closeChannel, MOCK_MODE, updateAllocation } from "@/lib/services/yellow";

/**
 * POST /api/cron/auto-release
 *
 * Vercel Cron job that checks for bounties past their review deadline
 * and automatically releases payment to the agent via Yellow state channels.
 *
 * Runs daily at midnight UTC via Vercel Cron. Protected by CRON_SECRET.
 * Can also be called manually (e.g. during demos) — if CRON_SECRET is not
 * set, the endpoint is open; otherwise pass `Authorization: Bearer <secret>`.
 *
 * Bounties eligible for auto-release:
 * - status = "SUBMITTED"
 * - review_deadline < now
 * - dispute_status is NOT "PENDING"
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret (Vercel sends this automatically for cron jobs)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const now = Date.now();
    const supabase = getSupabaseServerClient();

    // Find all bounties past review deadline
    const { data: expiredBounties, error: queryError } = await supabase
      .from<BountyRow>("bounties")
      .select("*")
      .eq("status", "SUBMITTED")
      .lt("review_deadline", now)
      .or("dispute_status.is.null,dispute_status.neq.PENDING");

    if (queryError) {
      throw queryError;
    }

    if (!expiredBounties || expiredBounties.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "No bounties eligible for auto-release.",
      });
    }

    console.log(
      `[Auto-Release] Found ${expiredBounties.length} bounties past review deadline`
    );

    const results: Array<{
      bountyId: string;
      status: "released" | "failed";
      settlementTxHash?: string;
      error?: string;
    }> = [];

    for (const bounty of expiredBounties as BountyRow[]) {
      try {
        let settlementTxHash: string | null = null;

        // Settle via Yellow state channel
        if (bounty.yellow_channel_id && bounty.assigned_agent_address) {
          try {
            console.log(
              `[Auto-Release] Releasing payment for bounty ${bounty.id} via channel ${bounty.yellow_channel_id}`
            );

            // Allocate full reward to agent
            await updateAllocation(bounty.yellow_channel_id, {
              [bounty.assigned_agent_address]: Number(bounty.reward),
              [bounty.poster_address]: 0,
            });

            const closeResult = await closeChannel(bounty.yellow_channel_id);
            settlementTxHash = closeResult.txHash || null;
          } catch (channelError) {
            console.error(
              `[Auto-Release] Channel settlement failed for ${bounty.id}:`,
              channelError
            );
          }
        }

        // Update bounty status
        const { error: updateError } = await supabase
          .from<BountyRow>("bounties")
          .update({
            status: "AUTO_RELEASED",
            completed_at: now,
            settlement_tx_hash: settlementTxHash,
          })
          .eq("id", bounty.id);

        if (updateError) {
          throw updateError;
        }

        // Update agent reputation (+1 completed job)
        if (bounty.assigned_agent_id) {
          const { data: agentData } = await supabase
            .from<AgentRow>("agents")
            .select("*")
            .eq("id", bounty.assigned_agent_id)
            .maybeSingle();

          if (agentData) {
            const agent = agentData as AgentRow;
            const reputation = normalizeReputation(agent.reputation);
            const feedbackHistory = Array.isArray(agent.feedback_history)
              ? [...agent.feedback_history]
              : [];

            const nextReputation = {
              score: reputation.score + 0.2,
              totalJobs: reputation.totalJobs + 1,
              positive: reputation.positive + 1,
              negative: reputation.negative,
              confidence: Math.min(1, (reputation.totalJobs + 1) / 10),
            };

            feedbackHistory.push({
              bountyId: bounty.id,
              bountyTitle: bounty.title,
              rating: 5,
              comment:
                "Auto-released: poster did not review within deadline.",
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

        results.push({
          bountyId: bounty.id,
          status: "released",
          settlementTxHash: settlementTxHash || undefined,
        });

        console.log(`[Auto-Release] Bounty ${bounty.id} auto-released`);
      } catch (bountyError) {
        const errorMessage =
          bountyError instanceof Error ? bountyError.message : "Unknown error";
        console.error(
          `[Auto-Release] Failed to process bounty ${bounty.id}:`,
          bountyError
        );
        results.push({
          bountyId: bounty.id,
          status: "failed",
          error: errorMessage,
        });
      }
    }

    const released = results.filter((r) => r.status === "released").length;
    const failed = results.filter((r) => r.status === "failed").length;

    console.log(
      `[Auto-Release] Complete: ${released} released, ${failed} failed`
    );

    return NextResponse.json({
      success: true,
      processed: results.length,
      released,
      failed,
      yellowMode: MOCK_MODE ? "mock" : "production",
      results,
    });
  } catch (error) {
    console.error("[Auto-Release] Cron job error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CRON_ERROR",
          message: "Auto-release cron job failed",
        },
      },
      { status: 500 }
    );
  }
}

// Also support GET for Vercel cron (Vercel cron sends GET requests)
export async function GET(request: NextRequest) {
  return POST(request);
}
