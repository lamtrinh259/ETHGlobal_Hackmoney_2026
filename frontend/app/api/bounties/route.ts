import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";

import {
  CHAIN_CONFIG,
  getPaymentToken,
  type SupportedNetwork,
} from "@/lib/contracts/addresses";
import { mapBountyRow, type BountyRow } from "@/lib/supabase/models";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { openChannel } from "@/lib/services/yellow";
import type {
  BountyStatus,
  BountyType,
  CreateBountyInput,
} from "@/lib/types/bounty";

const DEFAULT_SUBMIT_DEADLINE_DAYS = 3;
const MAX_SUBMIT_DEADLINE_DAYS = 30;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

function errorResponse(code: string, message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    { status }
  );
}

function normalizeSkills(skills: string[]): string[] {
  return skills
    .map((value) => value.toLowerCase().trim())
    .filter((value) => value.length > 0);
}

// POST /api/bounties - Create a new bounty
export async function POST(request: NextRequest) {
  try {
    const body: CreateBountyInput = await request.json();
    const {
      title,
      description,
      reward,
      rewardToken = "USDC",
      type = "STANDARD",
      requiredSkills,
      requirements,
      submitDeadlineDays = DEFAULT_SUBMIT_DEADLINE_DAYS,
      posterAddress,
    } = body;

    if (!title || title.trim().length === 0) {
      return errorResponse("INVALID_TITLE", "Bounty title required");
    }

    if (title.length > 100) {
      return errorResponse("INVALID_TITLE", "Title must be 100 characters or less");
    }

    if (!description || description.trim().length === 0) {
      return errorResponse("INVALID_DESCRIPTION", "Bounty description required");
    }

    if (typeof reward !== "number" || !Number.isFinite(reward) || reward < 1) {
      return errorResponse("INVALID_REWARD", "Reward must be at least 1 USDC");
    }

    if (!posterAddress || !isAddress(posterAddress)) {
      return errorResponse(
        "INVALID_POSTER_ADDRESS",
        "Valid poster wallet address required"
      );
    }

    if (!requiredSkills || !Array.isArray(requiredSkills) || requiredSkills.length === 0) {
      return errorResponse("INVALID_SKILLS", "At least one required skill needed");
    }

    if (!requirements || typeof requirements !== "string") {
      return errorResponse("INVALID_REQUIREMENTS", "Requirements description required");
    }

    if (type && !["STANDARD", "PROPOSAL"].includes(type)) {
      return errorResponse("INVALID_TYPE", "Type must be STANDARD or PROPOSAL");
    }

    const safeSubmitDeadlineDays =
      typeof submitDeadlineDays === "number" && Number.isFinite(submitDeadlineDays)
        ? submitDeadlineDays
        : DEFAULT_SUBMIT_DEADLINE_DAYS;

    if (safeSubmitDeadlineDays < 1 || safeSubmitDeadlineDays > MAX_SUBMIT_DEADLINE_DAYS) {
      return errorResponse(
        "INVALID_SUBMIT_DEADLINE",
        `Submit deadline must be between 1 and ${MAX_SUBMIT_DEADLINE_DAYS} days`
      );
    }

    const now = Date.now();
    const bountyId = `bounty_${now}`;
    const skills = normalizeSkills(requiredSkills as string[]);

    let yellowChannelId: string | undefined;
    let yellowSessionId: string | undefined;
    let channelTxHash: string | undefined;

    try {
      // Sepolia-first deployment mode for hackathon testing.
      const network = "sepolia" as SupportedNetwork;

      const tokenAddress = getPaymentToken(network);

      const channelResult = await openChannel({
        poster: posterAddress,
        agent: "0x0000000000000000000000000000000000000000",
        deposit: reward,
        token: tokenAddress,
        chainId: CHAIN_CONFIG[network].chainId,
      });

      yellowChannelId = channelResult.channelId;
      yellowSessionId = channelResult.sessionId;
      channelTxHash = channelResult.txHash;
    } catch (yellowError) {
      console.warn(
        "[Bounty API] Yellow channel creation skipped (mock mode or error):",
        yellowError
      );
    }

    const supabase = getSupabaseServerClient();
    const { error: insertError } = await supabase.from("bounties").insert({
      id: bountyId,
      title: title.trim(),
      description: description.trim(),
      reward,
      reward_token: rewardToken,
      type,
      status: "OPEN",
      poster_address: posterAddress.toLowerCase(),
      required_skills: skills,
      requirements: requirements.trim(),
      yellow_channel_id: yellowChannelId ?? null,
      yellow_session_id: yellowSessionId ?? null,
      created_at: now,
      submit_deadline: now + safeSubmitDeadlineDays * DAY_MS,
    });

    if (insertError) {
      throw insertError;
    }

    const bounty = {
      id: bountyId,
      title: title.trim(),
      description: description.trim(),
      reward,
      rewardToken,
      type,
      status: "OPEN",
      posterAddress: posterAddress.toLowerCase(),
      requiredSkills: skills,
      requirements: requirements.trim(),
      yellowChannelId,
      yellowSessionId,
      createdAt: now,
      submitDeadline: now + safeSubmitDeadlineDays * DAY_MS,
    };

    return NextResponse.json({
      success: true,
      bountyId,
      bounty,
      channelTxHash,
      message: yellowChannelId
        ? `Bounty created with Yellow Network channel! ${
            channelTxHash ? `Tx: ${channelTxHash}` : ""
          }`
        : "Bounty created! Yellow channel will be opened when an agent claims.",
    });
  } catch (error) {
    console.error("Create bounty error:", error);
    return errorResponse("SERVER_ERROR", "Failed to create bounty", 500);
  }
}

// GET /api/bounties - List bounties with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as BountyStatus | null;
    const type = searchParams.get("type") as BountyType | null;
    const skills = searchParams.get("skills");
    const minReward = searchParams.get("minReward");
    const posterAddress = searchParams.get("posterAddress");
    const agentAddress = searchParams.get("agentAddress");
    const parsedLimit = Number.parseInt(
      searchParams.get("limit") || `${DEFAULT_LIMIT}`,
      10
    );
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, MAX_LIMIT)
        : DEFAULT_LIMIT;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("bounties")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    let bounties = (data ?? []).map((row) => mapBountyRow(row as BountyRow));

    if (status) {
      bounties = bounties.filter((bounty) => bounty.status === status);
    }

    if (type) {
      bounties = bounties.filter((bounty) => bounty.type === type);
    }

    if (skills) {
      const skillList = skills
        .toLowerCase()
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      bounties = bounties.filter((bounty) =>
        skillList.some((skill) =>
          bounty.requiredSkills.some((requiredSkill) => requiredSkill.includes(skill))
        )
      );
    }

    if (minReward) {
      const minRewardNum = parseFloat(minReward);
      if (Number.isFinite(minRewardNum)) {
        bounties = bounties.filter((bounty) => bounty.reward >= minRewardNum);
      }
    }

    if (posterAddress) {
      bounties = bounties.filter(
        (bounty) => bounty.posterAddress.toLowerCase() === posterAddress.toLowerCase()
      );
    }

    if (agentAddress) {
      bounties = bounties.filter(
        (bounty) =>
          bounty.assignedAgentAddress?.toLowerCase() === agentAddress.toLowerCase()
      );
    }

    bounties = bounties.slice(0, limit);

    return NextResponse.json({
      success: true,
      bounties,
      total: bounties.length,
    });
  } catch (error) {
    console.error("List bounties error:", error);
    return errorResponse("SERVER_ERROR", "Failed to list bounties", 500);
  }
}
