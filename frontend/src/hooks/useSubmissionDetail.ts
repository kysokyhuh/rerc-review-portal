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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, sla] = await Promise.all([
        fetchSubmissionDetail(submissionId),
        fetchSubmissionSlaSummary(submissionId).catch(() => null),
      ]);
      setSubmission(detail);
      setSlaSummary(sla);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load submission");
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const [detail, sla] = await Promise.all([
          fetchSubmissionDetail(submissionId),
          fetchSubmissionSlaSummary(submissionId).catch(() => null),
        ]);
        if (!isMounted) return;
        setSubmission(detail);
        setSlaSummary(sla);
        setError(null);
      } catch (err) {
        if (!isMounted) return;
        setError(
          err instanceof Error ? err.message : "Failed to load submission"
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [submissionId]);

  return { submission, slaSummary, loading, error, reload: load, setSubmission };
}
