import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type WarningSeverity = "low" | "medium" | "high" | "critical";
export type WarningStatus = "pending" | "active" | "resolved" | "false_alarm";

export interface EarlyWarning {
  id: string;
  author_id: string;
  title: string;
  description: string;
  category: string;
  severity: WarningSeverity;
  status: WarningStatus;
  community: string;
  ward: string | null;
  latitude: number | null;
  longitude: number | null;
  location_accuracy_m: number | null;
  occurred_at: string;
  created_at: string;
  verified_by: string | null;
  verified_at: string | null;
  moderator_note: string | null;
}

export interface NewEarlyWarning {
  title: string;
  description: string;
  category: string;
  severity: WarningSeverity;
  community: string;
  ward?: string;
  latitude?: number | null;
  longitude?: number | null;
  location_accuracy_m?: number | null;
}

export function useEarlyWarnings() {
  const [warnings, setWarnings] = useState<EarlyWarning[]>([]);
  const [confirmations, setConfirmations] = useState<
    { warning_id: string; user_id: string }[]
  >([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [warningResult, confirmResult] = await Promise.all([
      supabase
        .from("safebenue_early_warnings")
        .select(
          "id,author_id,title,description,category,severity,status,community,ward,latitude,longitude,location_accuracy_m,occurred_at,created_at,verified_by,verified_at,moderator_note",
        )
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("safebenue_warning_confirmations")
        .select("warning_id,user_id"),
    ]);

    if (warningResult.error) {
      setError(warningResult.error.message);
    } else {
      setError(null);
      setWarnings((warningResult.data ?? []) as EarlyWarning[]);
      setConfirmations(confirmResult.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void supabase.auth.getUser().then(async ({ data }) => {
      if (cancelled) return;
      const id = data.user?.id ?? null;
      setUserId(id);
      if (!id) return;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", id);
      if (!cancelled) {
        setIsModerator(
          Boolean(
            roles?.some(
              (role) => role.role === "moderator" || role.role === "admin",
            ),
          ),
        );
      }
    });

    void load();

    const channel = supabase
      .channel("safebenue-early-warnings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "safebenue_early_warnings" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "safebenue_warning_confirmations" },
        () => void load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const confirmationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    confirmations.forEach((c) =>
      counts.set(c.warning_id, (counts.get(c.warning_id) ?? 0) + 1),
    );
    return counts;
  }, [confirmations]);

  const myConfirmations = useMemo(
    () =>
      new Set(
        confirmations
          .filter((c) => c.user_id === userId)
          .map((c) => c.warning_id),
      ),
    [confirmations, userId],
  );

  async function postWarning(input: NewEarlyWarning) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error("Sign in to post an early warning");

    const { error: insertError } = await supabase
      .from("safebenue_early_warnings")
      .insert({
        author_id: data.user.id,
        title: input.title,
        description: input.description,
        category: input.category,
        severity: input.severity,
        status: "pending",
        community: input.community,
        ward: input.ward?.trim() || null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        location_accuracy_m: input.location_accuracy_m ?? null,
      });
    if (insertError) throw insertError;
  }

  async function toggleConfirmation(warningId: string) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error("Sign in to confirm a warning");

    if (myConfirmations.has(warningId)) {
      const { error: delError } = await supabase
        .from("safebenue_warning_confirmations")
        .delete()
        .eq("warning_id", warningId)
        .eq("user_id", data.user.id);
      if (delError) throw delError;
    } else {
      const { error: insError } = await supabase
        .from("safebenue_warning_confirmations")
        .insert({ warning_id: warningId, user_id: data.user.id });
      if (insError) throw insError;
    }
  }

  async function setStatus(
    warningId: string,
    status: WarningStatus,
    moderatorNote?: string,
  ) {
    const update: Database["public"]["Tables"]["safebenue_early_warnings"]["Update"] = { status };
    if (isModerator && (status === "active" || status === "false_alarm")) {
      update.verified_by = userId;
      update.verified_at = new Date().toISOString();
      update.moderator_note = moderatorNote?.trim() || null;
    }

    const { error: updError } = await supabase
      .from("safebenue_early_warnings")
      .update(update)
      .eq("id", warningId);
    if (updError) throw updError;
  }

  return {
    warnings,
    loading,
    error,
    userId,
    isModerator,
    confirmationCounts,
    myConfirmations,
    postWarning,
    toggleConfirmation,
    setStatus,
    refresh: load,
  };
}
