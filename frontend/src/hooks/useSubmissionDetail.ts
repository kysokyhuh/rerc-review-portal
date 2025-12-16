import { useEffect, useState } from "react";
import {
  SubmissionDetail,
  SubmissionSlaSummary,
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

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
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

    load();
    return () => {
      isMounted = false;
    };
  }, [submissionId]);

  return { submission, slaSummary, loading, error };
}
