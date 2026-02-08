import { NextRequest, NextResponse } from "next/server";

import { mapAgentRow, type AgentRow } from "@/lib/supabase/models";
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

// GET /api/agents/:id - Get single agent
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
      return errorResponse("AGENT_NOT_FOUND", "Agent not found", 404);
    }

    const agent = mapAgentRow(data as AgentRow);

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        walletAddress: agent.walletAddress,
        name: agent.name,
        ensName: agent.ensName,
        skills: agent.skills,
        erc8004Id: agent.erc8004Id,
        reputation: agent.reputation,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get agent error:", error);
    return errorResponse("SERVER_ERROR", "Failed to get agent", 500);
  }
}

// PATCH /api/agents/:id - Update agent
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const ensName = typeof body.ensName === "string" ? body.ensName.trim() : null;
    const skills = Array.isArray(body.skills) ? (body.skills as string[]) : null;

    const updates: Record<string, unknown> = {
      updated_at: Date.now(),
    };

    if (name) {
      updates.name = name;
    }

    if (ensName !== null) {
      updates.ens_name = ensName || null;
    }

    if (skills && skills.length > 0) {
      updates.skills = skills
        .map((value) => value.toLowerCase().trim())
        .filter((value) => value.length > 0);
    }

    const supabase = getSupabaseServerClient();

    const { data: updatedRows, error } = await supabase
      .from("agents")
      .update(updates)
      .eq("id", id)
      .select("*");

    if (error) {
      throw error;
    }

    if (!updatedRows || updatedRows.length === 0) {
      return errorResponse("AGENT_NOT_FOUND", "Agent not found", 404);
    }

    const agent = mapAgentRow(updatedRows[0] as AgentRow);

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        walletAddress: agent.walletAddress,
        name: agent.name,
        ensName: agent.ensName,
        skills: agent.skills,
        erc8004Id: agent.erc8004Id,
        reputation: agent.reputation,
        updatedAt: agent.updatedAt,
      },
      message: "Agent updated successfully",
    });
  } catch (error) {
    console.error("Update agent error:", error);
    return errorResponse("SERVER_ERROR", "Failed to update agent", 500);
  }
}
