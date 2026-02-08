import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Address } from "viem";

import { IDENTITY_REGISTRY_ABI } from "@/lib/contracts/abis/identityRegistry";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { getAgentId, publicClient } from "@/lib/contracts/erc8004";
import {
  EnsSubdomainError,
  extractRequestedEnsLabel,
  getEnsParentDomain,
  registerEnsSubdomain,
} from "@/lib/services/ens-subdomain";
import {
  DEFAULT_REPUTATION,
  mapAgentRow,
  normalizeReputation,
  type AgentRow,
} from "@/lib/supabase/models";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function badRequest(code: string, message: string, status = 400) {
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

// POST /api/agents - Register a new agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const wallet = typeof body.wallet === "string" ? body.wallet : "";
    const name = typeof body.name === "string" ? body.name : "";
    const skills = Array.isArray(body.skills) ? (body.skills as string[]) : [];
    const ensNameInput = typeof body.ensName === "string" ? body.ensName.trim().toLowerCase() : "";

    if (!wallet || !isAddress(wallet)) {
      return badRequest("INVALID_WALLET", "Valid wallet address required");
    }

    if (!name.trim()) {
      return badRequest("INVALID_NAME", "Agent name required");
    }

    if (!skills.length) {
      return badRequest("INVALID_SKILLS", "At least one skill required");
    }

    const walletLower = wallet.toLowerCase();
    const normalizedSkills = normalizeSkills(skills);
    const parentDomain = getEnsParentDomain();
    const requestedEnsLabel = ensNameInput
      ? extractRequestedEnsLabel(ensNameInput, parentDomain)
      : null;
    let resolvedEnsName: string | null = ensNameInput || null;
    if (requestedEnsLabel) {
      resolvedEnsName = `${requestedEnsLabel}.${parentDomain}`;
    }

    if (!normalizedSkills.length) {
      return badRequest("INVALID_SKILLS", "At least one non-empty skill required");
    }

    const supabase = getSupabaseServerClient();

    let existingId: bigint | null = null;
    try {
      existingId = await getAgentId(wallet as Address);
    } catch (err) {
      console.warn("Could not check on-chain registration:", err);
    }

    const { data: existingAgent, error: existingAgentError } = await supabase
      .from("agents")
      .select("*")
      .eq("wallet_address", walletLower)
      .maybeSingle();

    if (existingAgentError) {
      throw existingAgentError;
    }

    if (existingAgent) {
      let mapped = mapAgentRow(existingAgent as AgentRow);
      let ensRegistration:
        | Awaited<ReturnType<typeof registerEnsSubdomain>>
        | null = null;

      if (requestedEnsLabel && !mapped.ensName) {
        ensRegistration = await registerEnsSubdomain({
          label: requestedEnsLabel,
          walletAddress: wallet as Address,
          textRecords: [
            { key: "clawork.skills", value: normalizedSkills.join(",") },
            { key: "clawork.status", value: "available" },
            { key: "clawork.preferredChain", value: "11155111" },
          ],
        });
        resolvedEnsName = ensRegistration.ensName;

        const { data: updatedRows, error: updateError } = await supabase
          .from("agents")
          .update({
            ens_name: ensRegistration.ensName,
            updated_at: Date.now(),
          })
          .eq("id", mapped.id)
          .select("*");

        if (updateError) {
          throw updateError;
        }

        if (updatedRows && updatedRows.length > 0) {
          mapped = mapAgentRow(updatedRows[0] as AgentRow);
        }
      }

      return NextResponse.json({
        success: true,
        agentId: mapped.id,
        erc8004Id: mapped.erc8004Id || null,
        walletAddress: mapped.walletAddress,
        name: mapped.name,
        skills: mapped.skills,
        ensName: mapped.ensName,
        reputation: mapped.reputation,
        ensRegistration,
        message: ensRegistration
          ? "Agent already existed; ENS subdomain has now been assigned."
          : "Agent already registered",
      });
    }

    let ensRegistration:
      | Awaited<ReturnType<typeof registerEnsSubdomain>>
      | null = null;

    if (requestedEnsLabel && resolvedEnsName) {
      const { data: ensOwnerRow, error: ensOwnerError } = await supabase
        .from("agents")
        .select("*")
        .eq("ens_name", resolvedEnsName)
        .maybeSingle();

      if (ensOwnerError) {
        throw ensOwnerError;
      }

      if (ensOwnerRow && (ensOwnerRow as AgentRow).wallet_address !== walletLower) {
        return badRequest(
          "ENS_SUBDOMAIN_TAKEN",
          `${resolvedEnsName} is already assigned to another agent.`,
          409
        );
      }

      ensRegistration = await registerEnsSubdomain({
        label: requestedEnsLabel,
        walletAddress: wallet as Address,
        textRecords: [
          { key: "clawork.skills", value: normalizedSkills.join(",") },
          { key: "clawork.status", value: "available" },
          { key: "clawork.preferredChain", value: "11155111" },
        ],
      });
      resolvedEnsName = ensRegistration.ensName;
    }

    const agentId = `agent_${Date.now()}`;
    const now = Date.now();

    const { error: insertError } = await supabase.from("agents").insert({
      id: agentId,
      wallet_address: walletLower,
      name: name.trim(),
      ens_name: resolvedEnsName,
      skills: normalizedSkills,
      erc8004_id: existingId?.toString() || null,
      reputation: DEFAULT_REPUTATION,
      feedback_history: [],
      created_at: now,
      updated_at: now,
    });

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      agentId,
      erc8004Id: existingId?.toString() || null,
      walletAddress: walletLower,
      name: name.trim(),
      ensName: resolvedEnsName,
      skills: normalizedSkills,
      reputation: DEFAULT_REPUTATION,
      ensRegistration,
      message: ensRegistration
        ? "Agent registered and ENS subdomain issued on Sepolia."
        : existingId
          ? "Agent registered! ERC-8004 identity found on-chain."
          : "Agent registered! Connect wallet to mint ERC-8004 identity.",
    });
  } catch (error) {
    if (error instanceof EnsSubdomainError) {
      return badRequest(error.code, error.message, error.status);
    }
    console.error("Agent registration error:", error);
    return badRequest("SERVER_ERROR", "Failed to register agent", 500);
  }
}

// GET /api/agents - List all agents with pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const skill = searchParams.get("skill");
    const wallet = searchParams.get("wallet");
    const search = searchParams.get("search");
    const minReputation = searchParams.get("minReputation")
      ? parseFloat(searchParams.get("minReputation") as string)
      : null;
    const verified = searchParams.get("verified") === "true";
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";
    const cursor = searchParams.get("cursor");
    const limitParam = parseInt(searchParams.get("limit") || "20", 10);
    const limitNum = Math.min(Number.isFinite(limitParam) ? limitParam : 20, 100);

    const sortColumn =
      sortBy === "name"
        ? "name"
        : sortBy === "updatedAt"
          ? "updated_at"
          : "created_at";

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("agents")
      .select("*")
      .order(sortColumn, { ascending: order === "asc" });

    if (error) {
      throw error;
    }

    let agents = (data ?? []).map((row) => mapAgentRow(row as AgentRow));

    if (sortBy === "reputation" || sortBy === "reputation.score") {
      agents.sort((a, b) => {
        const diff = a.reputation.score - b.reputation.score;
        return order === "asc" ? diff : -diff;
      });
    }

    if (wallet) {
      const walletLower = wallet.toLowerCase();
      agents = agents.filter((agent) => agent.walletAddress.toLowerCase() === walletLower);
    }

    if (skill) {
      const requestedSkills = skill
        .split(",")
        .map((value) => value.toLowerCase().trim())
        .filter(Boolean);
      agents = agents.filter((agent) =>
        requestedSkills.some((requested) =>
          agent.skills.some((agentSkill) => agentSkill.toLowerCase().includes(requested))
        )
      );
    }

    if (search) {
      const normalizedSearch = search.toLowerCase();
      agents = agents.filter((agent) => agent.name.toLowerCase().includes(normalizedSearch));
    }

    if (minReputation !== null && Number.isFinite(minReputation)) {
      agents = agents.filter((agent) => agent.reputation.score >= minReputation);
    }

    if (verified) {
      agents = agents.filter((agent) => Boolean(agent.erc8004Id));
    }

    const total = agents.length;

    if (cursor) {
      const cursorIndex = agents.findIndex((agent) => agent.id === cursor);
      if (cursorIndex >= 0) {
        agents = agents.slice(cursorIndex + 1);
      }
    }

    const hasMore = agents.length > limitNum;
    const paginated = agents.slice(0, limitNum);
    const nextCursor = hasMore && paginated.length > 0 ? paginated[paginated.length - 1].id : null;

    return NextResponse.json({
      success: true,
      agents: paginated.map((agent) => ({
        id: agent.id,
        walletAddress: agent.walletAddress,
        name: agent.name,
        ensName: agent.ensName,
        skills: agent.skills,
        erc8004Id: agent.erc8004Id,
        reputation: normalizeReputation(agent.reputation),
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      })),
      pagination: {
        total,
        limit: limitNum,
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    console.error("List agents error:", error);
    return badRequest("SERVER_ERROR", "Failed to list agents", 500);
  }
}

// PATCH /api/agents - Update agent with ERC-8004 ID after minting
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const agentId = typeof body.agentId === "string" ? body.agentId : "";
    const erc8004Id = typeof body.erc8004Id === "string" ? body.erc8004Id : "";
    const wallet = typeof body.wallet === "string" ? body.wallet : "";

    if (!agentId) {
      return badRequest("INVALID_AGENT_ID", "Agent ID required");
    }

    if (!erc8004Id) {
      return badRequest("INVALID_ERC8004_ID", "ERC-8004 ID required");
    }

    if (!wallet || !isAddress(wallet)) {
      return badRequest("INVALID_WALLET", "Valid wallet address required");
    }

    try {
      const owner = await publicClient.readContract({
        address: CONTRACTS.IDENTITY_REGISTRY as Address,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "ownerOf",
        args: [BigInt(erc8004Id)],
      });

      if ((owner as string).toLowerCase() !== wallet.toLowerCase()) {
        return badRequest("NOT_OWNER", "Wallet does not own this ERC-8004 identity", 403);
      }
    } catch (chainError) {
      console.warn("Could not verify ERC-8004 ownership on-chain:", chainError);
    }

    const supabase = getSupabaseServerClient();
    const { data: updatedRows, error } = await supabase
      .from("agents")
      .update({
        erc8004_id: erc8004Id,
        updated_at: Date.now(),
      })
      .eq("id", agentId)
      .eq("wallet_address", wallet.toLowerCase())
      .select("*");

    if (error) {
      throw error;
    }

    if (!updatedRows || updatedRows.length === 0) {
      return badRequest("AGENT_NOT_FOUND", "Agent not found", 404);
    }

    const updated = mapAgentRow(updatedRows[0] as AgentRow);

    return NextResponse.json({
      success: true,
      agent: {
        id: updated.id,
        walletAddress: updated.walletAddress,
        name: updated.name,
        ensName: updated.ensName,
        skills: updated.skills,
        erc8004Id: updated.erc8004Id,
        reputation: updated.reputation,
        updatedAt: updated.updatedAt,
      },
      message: "ERC-8004 identity linked successfully",
    });
  } catch (error) {
    console.error("Update agent ERC-8004 error:", error);
    return badRequest("SERVER_ERROR", "Failed to update agent", 500);
  }
}
