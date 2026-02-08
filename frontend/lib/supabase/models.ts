export interface AgentReputation {
  score: number;
  totalJobs: number;
  positive: number;
  negative: number;
  confidence: number;
}

export interface AgentRow {
  id: string;
  wallet_address: string;
  name: string;
  ens_name: string | null;
  skills: string[] | null;
  erc8004_id: string | null;
  reputation: unknown;
  feedback_history: unknown;
  created_at: number;
  updated_at: number;
}

export interface BountyRow {
  id: string;
  title: string;
  description: string;
  reward: number | string;
  reward_token: string;
  type: string;
  status: string;
  poster_address: string;
  poster_name: string | null;
  assigned_agent_id: string | null;
  assigned_agent_address: string | null;
  assigned_agent_erc8004_id: string | null;
  yellow_channel_id: string | null;
  yellow_session_id: string | null;
  settlement_tx_hash: string | null;
  created_at: number;
  claimed_at: number | null;
  submitted_at: number | null;
  completed_at: number | null;
  submit_deadline: number | null;
  review_deadline: number | null;
  deliverable_cid: string | null;
  deliverable_message: string | null;
  required_skills: string[] | null;
  requirements: string | null;
  dispute_status: string | null;
  dispute_reason: string | null;
  dispute_timestamp: number | null;
  dispute_initiator: string | null;
  dispute_id: string | null;
}

export interface DisputeRow {
  id: string;
  bounty_id: string;
  agent_id: string | null;
  poster_address: string;
  reason: string;
  evidence_cid: string | null;
  status: string;
  decision: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: number;
  resolved_at: number | null;
}

export const DEFAULT_REPUTATION: AgentReputation = {
  score: 0,
  totalJobs: 0,
  positive: 0,
  negative: 0,
  confidence: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

export function normalizeReputation(value: unknown): AgentReputation {
  if (!isRecord(value)) {
    return { ...DEFAULT_REPUTATION };
  }

  return {
    score: toNumber(value.score, 0),
    totalJobs: toNumber(value.totalJobs, 0),
    positive: toNumber(value.positive, 0),
    negative: toNumber(value.negative, 0),
    confidence: toNumber(value.confidence, 0),
  };
}

export function mapAgentRow(row: AgentRow) {
  return {
    id: row.id,
    walletAddress: row.wallet_address,
    name: row.name,
    ensName: row.ens_name,
    skills: row.skills ?? [],
    erc8004Id: row.erc8004_id,
    reputation: normalizeReputation(row.reputation),
    feedbackHistory: Array.isArray(row.feedback_history) ? row.feedback_history : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapBountyRow(row: BountyRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    reward: toNumber(row.reward, 0),
    rewardToken: row.reward_token,
    type: row.type,
    status: row.status,
    posterAddress: row.poster_address,
    posterName: row.poster_name,
    assignedAgentId: row.assigned_agent_id,
    assignedAgentAddress: row.assigned_agent_address,
    assignedAgentErc8004Id: row.assigned_agent_erc8004_id,
    yellowChannelId: row.yellow_channel_id,
    yellowSessionId: row.yellow_session_id,
    settlementTxHash: row.settlement_tx_hash,
    createdAt: row.created_at,
    claimedAt: row.claimed_at,
    submittedAt: row.submitted_at,
    completedAt: row.completed_at,
    submitDeadline: row.submit_deadline,
    reviewDeadline: row.review_deadline,
    deliverableCID: row.deliverable_cid,
    deliverableMessage: row.deliverable_message,
    requiredSkills: row.required_skills ?? [],
    requirements: row.requirements ?? "",
    disputeStatus: row.dispute_status,
    disputeReason: row.dispute_reason,
    disputeTimestamp: row.dispute_timestamp,
    disputeInitiator: row.dispute_initiator,
    disputeId: row.dispute_id,
  };
}
