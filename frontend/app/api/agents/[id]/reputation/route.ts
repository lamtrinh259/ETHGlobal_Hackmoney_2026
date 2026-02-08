import { NextRequest, NextResponse } from "next/server";

import { getAgentFeedback, getAgentReputation } from "@/lib/contracts/erc8004";
import {
  mapAgentRow,
  normalizeReputation,
  type AgentRow,
} from "@/lib/supabase/models";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function responseError(code: string, message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    { status }
  );
}

// GET /api/agents/:id/reputation - Get agent reputation
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("agents")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return responseError("AGENT_NOT_FOUND", "Agent not found", 404);
    }

    const agent = mapAgentRow(data as AgentRow);
    const reputation = normalizeReputation(agent.reputation);

    let onChainReputation: { score: number; totalFeedback: number } | null = null;
    let onChainFeedback: Array<{
      from: string;
      rating: number;
      comment: string;
      timestamp: string;
    }> = [];

    if (agent.erc8004Id) {
      try {
        const rep = await getAgentReputation(BigInt(agent.erc8004Id));
        if (rep) {
          onChainReputation = {
            score: Number(rep.score),
            totalFeedback: Number(rep.totalFeedback),
          };
        }

        const feedback = await getAgentFeedback(BigInt(agent.erc8004Id));
        onChainFeedback = feedback.map((entry) => ({
          from: entry.from,
          rating: entry.rating,
          comment: entry.comment,
          timestamp: entry.timestamp.toString(),
        }));
      } catch (chainError) {
        console.warn("Could not fetch on-chain reputation:", chainError);
      }
    }

    return NextResponse.json({
      success: true,
      agentId: id,
      erc8004Id: agent.erc8004Id,
      reputation: {
        score: reputation.score,
        totalJobs: reputation.totalJobs,
        confidence: reputation.confidence,
        breakdown: {
          positive: reputation.positive,
          neutral: reputation.totalJobs - reputation.positive - reputation.negative,
          negative: reputation.negative,
        },
      },
      onChain: onChainReputation
        ? {
            score: onChainReputation.score,
            totalFeedback: onChainReputation.totalFeedback,
            feedback: onChainFeedback,
          }
        : null,
    });
  } catch (error) {
    console.error("Get reputation error:", error);
    return responseError("SERVER_ERROR", "Failed to get reputation", 500);
  }
}
