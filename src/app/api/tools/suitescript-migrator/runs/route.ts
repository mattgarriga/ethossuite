import { headers } from "next/headers";
import { ApiFailure, failFrom, json } from "@/lib/api";
import { assertCanSpend, checkAndRecordRateLimit, clientIp, hashIp } from "@/lib/limits";
import { requireToolContext } from "@/lib/suitescript/context";
import { MAX_FILES, MAX_FILE_BYTES } from "@/lib/suitescript/upload";
import type { CreateRunResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  try {
    const { user, admin, toolId } = await requireToolContext();
    await assertCanSpend(admin);
    const ipHash = hashIp(clientIp(await headers()));
    await checkAndRecordRateLimit(admin, { userId: user.id, ipHash, toolId });

    const { data, error } = await admin
      .from("runs")
      .insert({ user_id: user.id, tool_id: toolId, status: "pending" })
      .select("id")
      .single();
    if (error || !data) throw new ApiFailure("internal", "Could not start the assessment.");

    const body: CreateRunResponse = { runId: data.id, maxFiles: MAX_FILES, maxFileBytes: MAX_FILE_BYTES };
    return json(body, 201);
  } catch (err) {
    return failFrom(err);
  }
}
