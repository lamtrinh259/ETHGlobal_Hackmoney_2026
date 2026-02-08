#!/usr/bin/env node

/**
 * Live API smoke runner for Clawork demo rehearsal.
 *
 * Usage:
 *   DEMO_BASE_URL=http://localhost:3001 node scripts/live-demo-api-smoke.mjs
 */

const baseUrl = process.env.DEMO_BASE_URL || "http://localhost:3001";
const runId = Date.now();
const email = `demo.${runId}@example.com`;

/**
 * Create deterministic pseudo-addresses per run to avoid collisions with prior smoke data.
 * @param {bigint} seed
 */
function makeAddress(seed) {
  return `0x${seed.toString(16).padStart(40, "0").slice(-40)}`;
}

const baseSeed = BigInt(runId);
const posterAddressA = makeAddress(baseSeed + 0x111n);
const posterAddressB = makeAddress(baseSeed + 0x222n);
const agentAddress = makeAddress(baseSeed + 0x333n);

/** @typedef {{name: string, method: string, endpoint: string, expected: string, pass: boolean, status: number, detail: string}} CaseResult */
/** @type {CaseResult[]} */
const results = [];

/**
 * @param {string} name
 * @param {string} method
 * @param {string} endpoint
 * @param {string} expected
 * @param {object | null} body
 * @param {(status: number, json: any) => { pass: boolean, detail: string }} evaluate
 */
async function runCase(name, method, endpoint, expected, body, evaluate) {
  let status = 0;
  let json = null;
  let text = "";

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    status = response.status;
    text = await response.text();

    try {
      json = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown fetch error";
    results.push({
      name,
      method,
      endpoint,
      expected,
      pass: false,
      status: 0,
      detail,
    });
    return null;
  }

  const { pass, detail } = evaluate(status, json);

  results.push({
    name,
    method,
    endpoint,
    expected,
    pass,
    status,
    detail: detail || text.slice(0, 240),
  });

  return json;
}

function summarize() {
  const passCount = results.filter((item) => item.pass).length;
  const failCount = results.length - passCount;
  const summary = {
    baseUrl,
    timestamp: new Date().toISOString(),
    passCount,
    failCount,
    total: results.length,
    email,
    results,
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

async function main() {
  const waitlistMissing = await runCase(
    "Waitlist GET missing email",
    "GET",
    "/api/waitlist",
    "400 INVALID_EMAIL",
    null,
    (status, json) => ({
      pass: status === 400 && json?.error?.code === "INVALID_EMAIL",
      detail: json?.error?.message || "No error message",
    })
  );
  void waitlistMissing;

  const waitlistCreate = await runCase(
    "Waitlist POST create",
    "POST",
    "/api/waitlist",
    "200 success=true",
    { email, source: "live-demo-smoke" },
    (status, json) => ({
      pass: status === 200 && json?.success === true,
      detail: `id=${json?.id ?? "n/a"}`,
    })
  );
  void waitlistCreate;

  const waitlistExists = await runCase(
    "Waitlist GET exists",
    "GET",
    `/api/waitlist?email=${encodeURIComponent(email)}`,
    "200 exists=true",
    null,
    (status, json) => ({
      pass: status === 200 && json?.exists === true,
      detail: `exists=${json?.exists}`,
    })
  );
  void waitlistExists;

  const agentCreate = await runCase(
    "Agents POST register",
    "POST",
    "/api/agents",
    "200 success=true + agentId",
    {
      wallet: agentAddress,
      name: "Demo Agent",
      skills: ["typescript", "testing", "solidity"],
    },
    (status, json) => ({
      pass: status === 200 && json?.success === true && Boolean(json?.agentId),
      detail: `agentId=${json?.agentId ?? "n/a"}`,
    })
  );

  const agentId = agentCreate?.agentId;
  if (!agentId) {
    summarize();
    process.exit(1);
  }

  const agentsList = await runCase(
    "Agents GET list",
    "GET",
    "/api/agents?limit=5",
    "200 agents[]",
    null,
    (status, json) => ({
      pass: status === 200 && Array.isArray(json?.agents),
      detail: `count=${Array.isArray(json?.agents) ? json.agents.length : "n/a"}`,
    })
  );
  void agentsList;

  const agentGet = await runCase(
    "Agents GET by id",
    "GET",
    `/api/agents/${agentId}`,
    "200 agent.id matches",
    null,
    (status, json) => ({
      pass: status === 200 && json?.agent?.id === agentId,
      detail: `agent.id=${json?.agent?.id ?? "n/a"}`,
    })
  );
  void agentGet;

  const agentPatchProfile = await runCase(
    "Agents PATCH by id (profile fields)",
    "PATCH",
    `/api/agents/${agentId}`,
    "200 success=true",
    {
      name: "Demo Agent Updated",
      ensName: "demoagent.eth",
      skills: ["typescript", "ens", "yellow"],
    },
    (status, json) => ({
      pass: status === 200 && json?.success === true,
      detail: `ensName=${json?.agent?.ensName ?? "n/a"}`,
    })
  );
  void agentPatchProfile;

  const agentPatchErc8004 = await runCase(
    "Agents PATCH (link ERC-8004 id)",
    "PATCH",
    "/api/agents",
    "200 success=true",
    {
      agentId,
      wallet: agentAddress,
      erc8004Id: "999999999999999999",
    },
    (status, json) => ({
      pass: status === 200 && json?.success === true,
      detail: `erc8004Id=${json?.agent?.erc8004Id ?? "n/a"}`,
    })
  );
  void agentPatchErc8004;

  const reputationGet = await runCase(
    "Agents GET reputation",
    "GET",
    `/api/agents/${agentId}/reputation`,
    "200 success=true",
    null,
    (status, json) => ({
      pass: status === 200 && json?.success === true,
      detail: `score=${json?.reputation?.score ?? "n/a"}`,
    })
  );
  void reputationGet;

  const bountyCreateA = await runCase(
    "Bounties POST create (flow A)",
    "POST",
    "/api/bounties",
    "200 success=true + bountyId",
    {
      title: `Smoke bounty A ${runId}`,
      description: "Flow A happy path",
      requirements: "Submit anything",
      reward: 5,
      posterAddress: posterAddressA,
      requiredSkills: ["testing"],
    },
    (status, json) => ({
      pass: status === 200 && json?.success === true && Boolean(json?.bountyId),
      detail: `bountyId=${json?.bountyId ?? "n/a"} channel=${json?.bounty?.yellowChannelId ?? "n/a"} mode=${json?.yellowMode ?? "n/a"}`,
    })
  );

  const bountyIdA = bountyCreateA?.bountyId;
  if (!bountyIdA) {
    summarize();
    process.exit(1);
  }

  const bountiesListA = await runCase(
    "Bounties GET list",
    "GET",
    "/api/bounties?limit=5",
    "200 bounties[]",
    null,
    (status, json) => ({
      pass: status === 200 && Array.isArray(json?.bounties),
      detail: `count=${Array.isArray(json?.bounties) ? json.bounties.length : "n/a"}`,
    })
  );
  void bountiesListA;

  const bountyGetA1 = await runCase(
    "Bounty GET by id (pre-claim)",
    "GET",
    `/api/bounties/${bountyIdA}`,
    "200 status OPEN",
    null,
    (status, json) => ({
      pass: status === 200 && json?.bounty?.status === "OPEN",
      detail: `status=${json?.bounty?.status ?? "n/a"}`,
    })
  );
  void bountyGetA1;

  const bountyClaimA = await runCase(
    "Bounty POST claim",
    "POST",
    `/api/bounties/${bountyIdA}/claim`,
    "200 success=true",
    {
      agentId,
      agentAddress,
    },
    (status, json) => ({
      pass: status === 200 && json?.success === true,
      detail: `channelId=${json?.channelId ?? "n/a"} mode=${json?.yellowMode ?? "n/a"}`,
    })
  );
  void bountyClaimA;

  const bountySubmitA = await runCase(
    "Bounty POST submit",
    "POST",
    `/api/bounties/${bountyIdA}/submit`,
    "200 success=true",
    {
      agentId,
      message: "Submission from smoke test",
    },
    (status, json) => ({
      pass: status === 200 && json?.success === true,
      detail: `reviewDeadline=${json?.reviewDeadline ?? "n/a"}`,
    })
  );
  void bountySubmitA;

  const bountyApproveA = await runCase(
    "Bounty POST approve",
    "POST",
    `/api/bounties/${bountyIdA}/approve`,
    "200 status COMPLETED",
    {
      posterAddress: posterAddressA,
      approved: true,
      rating: 5,
      comment: "Great work",
    },
    (status, json) => ({
      pass: status === 200 && json?.status === "COMPLETED",
      detail: `status=${json?.status ?? "n/a"} mode=${json?.yellowMode ?? "n/a"}`,
    })
  );
  void bountyApproveA;

  const bountyGetA2 = await runCase(
    "Bounty GET by id (post-approve)",
    "GET",
    `/api/bounties/${bountyIdA}`,
    "200 status COMPLETED",
    null,
    (status, json) => ({
      pass: status === 200 && json?.bounty?.status === "COMPLETED",
      detail: `status=${json?.bounty?.status ?? "n/a"}`,
    })
  );
  void bountyGetA2;

  const bountyCreateB = await runCase(
    "Bounties POST create (flow B dispute)",
    "POST",
    "/api/bounties",
    "200 success=true + bountyId",
    {
      title: `Smoke bounty B ${runId}`,
      description: "Flow B dispute path",
      requirements: "Claim and dispute",
      reward: 4,
      posterAddress: posterAddressB,
      requiredSkills: ["dispute"],
    },
    (status, json) => ({
      pass: status === 200 && json?.success === true && Boolean(json?.bountyId),
      detail: `bountyId=${json?.bountyId ?? "n/a"}`,
    })
  );

  const bountyIdB = bountyCreateB?.bountyId;
  if (!bountyIdB) {
    summarize();
    process.exit(1);
  }

  const bountyClaimB = await runCase(
    "Bounty POST claim (flow B)",
    "POST",
    `/api/bounties/${bountyIdB}/claim`,
    "200 success=true",
    {
      agentId,
      agentAddress,
    },
    (status, json) => ({
      pass: status === 200 && json?.success === true,
      detail: `channelId=${json?.channelId ?? "n/a"}`,
    })
  );
  void bountyClaimB;

  const bountyDisputeB = await runCase(
    "Bounty POST dispute",
    "POST",
    `/api/bounties/${bountyIdB}/dispute`,
    "200 success=true + disputeId",
    {
      initiatorAddress: agentAddress,
      reason: "Demo dispute for adjudication flow",
    },
    (status, json) => ({
      pass: status === 200 && json?.success === true && Boolean(json?.disputeId),
      detail: `disputeId=${json?.disputeId ?? "n/a"}`,
    })
  );
  void bountyDisputeB;

  const bountyGetB = await runCase(
    "Bounty GET by id (post-dispute)",
    "GET",
    `/api/bounties/${bountyIdB}`,
    "200 disputeStatus PENDING",
    null,
    (status, json) => ({
      pass:
        status === 200 &&
        json?.bounty?.disputeStatus === "PENDING" &&
        json?.bounty?.status === "CLAIMED",
      detail: `status=${json?.bounty?.status ?? "n/a"} disputeStatus=${json?.bounty?.disputeStatus ?? "n/a"}`,
    })
  );
  void bountyGetB;

  summarize();
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Unknown error"}\n`
  );
  process.exit(1);
});
