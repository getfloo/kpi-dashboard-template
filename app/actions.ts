"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getIdentity } from "@/lib/identity";
import {
  MetricInput,
  MetricUpdate,
  PointInput,
  RequestError,
  createMetric,
  parse,
  recordPoints,
  sourceOf,
  updateMetric,
} from "@/lib/metrics";

/** What a form shows after submitting: the error to fix, or when it last saved. */
export type FormState = { error?: string; savedAt?: number } | null;

// Server actions are callable by any signed-in member, so the role is checked here,
// not only by hiding the form.
async function requireAdmin(): Promise<void> {
  const user = await getIdentity();
  if (user.role !== "admin") {
    throw new RequestError(403, "Only app admins can create or edit metrics.");
  }
}

async function formResult(run: () => Promise<void>): Promise<FormState> {
  try {
    await run();
    return { savedAt: Date.now() };
  } catch (error) {
    // Anything else, including redirect(), propagates.
    if (error instanceof RequestError) return { error: error.message };
    throw error;
  }
}

/** An empty field is "not given"; anything else must parse as a number. */
function numberField(form: FormData, name: string): number | undefined {
  const raw = String(form.get(name) ?? "").trim();
  return raw === "" ? undefined : Number(raw);
}

function metricFields(form: FormData) {
  return {
    key: form.get("key"),
    name: form.get("name"),
    unit: form.get("unit") ?? "",
    target: numberField(form, "target") ?? null,
    direction: form.get("direction"),
    owner: form.get("owner") ?? "",
  };
}

export async function createMetricAction(_state: FormState, form: FormData): Promise<FormState> {
  return formResult(async () => {
    await requireAdmin();
    const metric = await createMetric(parse(MetricInput, metricFields(form)));
    revalidatePath("/");
    redirect(`/metrics/${metric.key}`);
  });
}

export async function updateMetricAction(_state: FormState, form: FormData): Promise<FormState> {
  return formResult(async () => {
    await requireAdmin();
    const key = String(form.get("key"));
    await updateMetric(key, parse(MetricUpdate, metricFields(form)));
    revalidatePath("/");
    redirect(`/metrics/${key}`);
  });
}

/** Any signed-in member can record a value. */
export async function recordPointAction(_state: FormState, form: FormData): Promise<FormState> {
  return formResult(async () => {
    const user = await getIdentity();
    const key = String(form.get("metric"));
    const point = parse(PointInput, { value: numberField(form, "value"), recordedAt: form.get("date") || undefined });
    await recordPoints(sourceOf(user), [{ metric: key, ...point }]);
    revalidatePath("/");
    revalidatePath(`/metrics/${key}`);
  });
}
