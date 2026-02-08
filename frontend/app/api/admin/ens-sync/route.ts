import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  http,
  namehash,
  zeroAddress,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";

import { ENS_REGISTRY_ABI } from "@/lib/contracts/abis/ens";
import { ENS } from "@/lib/contracts/addresses";
import { registerEnsSubdomain, extractRequestedEnsLabel, getEnsParentDomain, EnsSubdomainError } from "@/lib/services/ens-subdomain";
import { mapAgentRow, type AgentRow } from "@/lib/supabase/models";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/ens-sync
 *
 * Admin endpoint to re-register ENS subdomains for agents that have an
 * ensName in the database but no on-chain records.
 *
 * Body: { agentId?: string }
 * - If agentId is provided, syncs only that agent
 * - If omitted, syncs all agents with missing on-chain ENS records
 *
 * Protected by CRON_SECRET (same as auto-release).
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const targetAgentId = typeof body.agentId === "string" ? body.agentId : null;

    const supabase = getSupabaseServerClient();
    const { data: allAgents, error: queryError } = await supabase
      .from<AgentRow>("agents")
      .select("*");

    if (queryError) {
      throw queryError;
    }

    // Filter agents that have ens_name but may not be on-chain
    const agentsWithEns = (allAgents ?? [])
      .map((row) => mapAgentRow(row as AgentRow))
      .filter((agent) => agent.ensName && agent.ensName.length > 0);

    const agentsToSync = targetAgentId
      ? agentsWithEns.filter((a) => a.id === targetAgentId)
      : agentsWithEns;

    if (agentsToSync.length === 0) {
      return NextResponse.json({
        success: true,
        message: targetAgentId
          ? "Agent not found or has no ENS name"
          : "No agents with ENS names to sync",
        synced: 0,
        skipped: 0,
        failed: 0,
        results: [],
      });
    }

    // Check on-chain status for each agent
    const rpcUrl =
      process.env.ENS_SEPOLIA_RPC ||
      process.env.NEXT_PUBLIC_SEPOLIA_RPC ||
      "https://ethereum-sepolia-rpc.publicnode.com";

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const registry = (process.env.NEXT_PUBLIC_SEPOLIA_ENS_REGISTRY ||
      ENS.REGISTRY) as Address;
    const parentDomain = getEnsParentDomain();

    const results: Array<{
      agentId: string;
      ensName: string;
      status: "synced" | "already_onchain" | "failed" | "skipped";
      txHashes?: Record<string, string | null>;
      error?: string;
    }> = [];

    for (const agent of agentsToSync) {
      const ensName = agent.ensName!;
      const subdomainNode = namehash(ensName);

      try {
        // Check if already on-chain
        const onChainOwner = (await publicClient.readContract({
          address: registry,
          abi: ENS_REGISTRY_ABI,
          functionName: "owner",
          args: [subdomainNode],
        })) as Address;

        if (onChainOwner !== zeroAddress) {
          results.push({
            agentId: agent.id,
            ensName,
            status: "already_onchain",
          });
          continue;
        }

        // Extract label for registration
        const label = extractRequestedEnsLabel(ensName, parentDomain);
        if (!label) {
          results.push({
            agentId: agent.id,
            ensName,
            status: "skipped",
            error: "Could not extract label from ENS name",
          });
          continue;
        }

        // Re-register on-chain
        const result = await registerEnsSubdomain({
          label,
          walletAddress: agent.walletAddress as Address,
          textRecords: [
            { key: "clawork.skills", value: agent.skills.join(",") },
            { key: "clawork.status", value: "available" },
            { key: "clawork.preferredChain", value: "11155111" },
          ],
        });

        results.push({
          agentId: agent.id,
          ensName,
          status: "synced",
          txHashes: {
            setSubnodeRecord: result.txHashes.setSubnodeRecord,
            setAddr: result.txHashes.setAddr,
            setOwner: result.txHashes.setOwner,
          },
        });

        console.log(`[ENS Sync] Registered ${ensName} for agent ${agent.id}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`[ENS Sync] Failed for ${ensName}:`, err);
        results.push({
          agentId: agent.id,
          ensName,
          status: "failed",
          error: message,
        });
      }
    }

    const synced = results.filter((r) => r.status === "synced").length;
    const alreadyOnchain = results.filter((r) => r.status === "already_onchain").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const skipped = results.filter((r) => r.status === "skipped").length;

    return NextResponse.json({
      success: true,
      synced,
      alreadyOnchain,
      failed,
      skipped,
      results,
    });
  } catch (error) {
    if (error instanceof EnsSubdomainError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: error.status }
      );
    }
    console.error("[ENS Sync] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "ENS sync failed" } },
      { status: 500 }
    );
  }
}
