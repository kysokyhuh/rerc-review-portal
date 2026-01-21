import { useCallback, useEffect, useState } from "react";
import type { SubmissionDetail, SubmissionSlaSummary } from "@/types";
import {
  fetchSubmissionDetail,
  fetchSubmissionSlaSummary,
} from "@/services/api";

export function useSubmissionDetail(submissionId: number) {
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [slaSummary, setSlaSummary] = useState<SubmissionSlaSummary | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isMountedRef?: { current: boolean }) => {
      setLoading(true);
      if (!Number.isFinite(submissionId)) {
        if (!isMountedRef || isMountedRef.current) {
          setError("Invalid submission id");
          setSubmission(null);
          setSlaSummary(null);
          setLoading(false);
        }
        return;
      }
      try {
        const [detail, sla] = await Promise.all([
          fetchSubmissionDetail(submissionId),
          fetchSubmissionSlaSummary(submissionId).catch(() => null),
        ]);
        if (!isMountedRef || isMountedRef.current) {
          setSubmission(detail);
          setSlaSummary(sla);
          setError(null);
        }
      } catch (err) {
        if (!isMountedRef || isMountedRef.current) {
          setError(
            err instanceof Error ? err.message : "Failed to load submission"
          );
        }
      } finally {
        if (!isMountedRef || isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [submissionId]
  );

  useEffect(() => {
    const mounted = { current: true };
    load(mounted);
    return () => {
      mounted.current = false;
    };
  }, [load, submissionId]);

  return { submission, slaSummary, loading, error, reload: load, setSubmission };
}
