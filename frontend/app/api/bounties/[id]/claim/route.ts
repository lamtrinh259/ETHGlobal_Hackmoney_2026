import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";

import { CHAIN_CONFIG, getPaymentToken } from "@/lib/contracts/addresses";
import { type AgentRow, type BountyRow } from "@/lib/supabase/models";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { MOCK_MODE, openChannelWithSDK } from "@/lib/services/yellow";

const DEFAULT_YELLOW_TIMEOUT_MS = 12000;

const parsedYellowTimeout = Number.parseInt(
  process.env.YELLOW_OPEN_CHANNEL_TIMEOUT_MS || `${DEFAULT_YELLOW_TIMEOUT_MS}`,
  10
);
const YELLOW_OPEN_CHANNEL_TIMEOUT_MS =
  Number.isFinite(parsedYellowTimeout) && parsedYellowTimeout > 0
    ? parsedYellowTimeout
    : DEFAULT_YELLOW_TIMEOUT_MS;

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

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// POST /api/bounties/:id/claim
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const agentId = typeof body.agentId === "string" ? body.agentId : "";
    const agentAddress =
      typeof body.agentAddress === "string" ? body.agentAddress : "";

    if (!agentId || !agentAddress || !isAddress(agentAddress)) {
      return errorResponse(
        "INVALID_AGENT",
        "Agent ID and a valid agent address are required"
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

    if (bounty.status !== "OPEN") {
      return errorResponse(
        "BOUNTY_ALREADY_CLAIMED",
        "Bounty has already been claimed",
        409
      );
    }

    const { data: agent, error: agentError } = await supabase
      .from<Pick<AgentRow, "id" | "erc8004_id">>("agents")
      .select("id, erc8004_id")
      .eq("id", agentId)
      .maybeSingle();

    if (agentError) {
      throw agentError;
    }

    if (!agent) {
      return errorResponse("AGENT_NOT_FOUND", "Agent not found", 404);
    }

    let channelId: string | null = null;
    let yellowMode: "mock" | "production" = MOCK_MODE ? "mock" : "production";
    try {
      const network = "sepolia" as const;
      // Wrap in a timeout to prevent the claim endpoint from hanging
      // if Yellow ClearNode WebSocket is unresponsive
      const channelPromise = openChannelWithSDK({
        poster: bounty.poster_address,
        agent: agentAddress.toLowerCase(),
        deposit: Number(bounty.reward),
        token: getPaymentToken(network),
        chainId: CHAIN_CONFIG[network].chainId,
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Yellow channel open timed out after 15s")), 15000)
      );
      const channel = await Promise.race([channelPromise, timeoutPromise]);
      channelId = channel.channelId;
      yellowMode = channel.mode;
    } catch (yellowError) {
      console.warn("Yellow channel open failed during claim:", yellowError);
    }

    const submitDeadline = Date.now() + 3 * 24 * 60 * 60 * 1000;

    const { data: updatedRows, error: updateError } = await supabase
      .from<BountyRow>("bounties")
      .update({
        status: "CLAIMED",
        assigned_agent_id: agentId,
        assigned_agent_address: agentAddress.toLowerCase(),
        assigned_agent_erc8004_id: agent.erc8004_id ?? null,
        yellow_channel_id: channelId,
        claimed_at: Date.now(),
        submit_deadline: submitDeadline,
      })
      .eq("id", id)
      .eq("status", "OPEN")
      .select("*");

    if (updateError) {
      throw updateError;
    }

    if (!updatedRows || updatedRows.length === 0) {
      return errorResponse(
        "BOUNTY_ALREADY_CLAIMED",
        "Bounty has already been claimed",
        409
      );
    }

    return NextResponse.json({
      success: true,
      channelId,
      yellowMode,
      submitDeadline,
      message:
        "Bounty claimed! Complete and submit your work before the deadline.",
    });
  } catch (error) {
    console.error("Claim bounty error:", error);
    return errorResponse("SERVER_ERROR", "Failed to claim bounty", 500);
  }
}
