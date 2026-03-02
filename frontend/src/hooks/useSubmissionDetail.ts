import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SubmissionDetail, SubmissionSlaSummary } from "@/types";
import { fetchSubmissionDetail, fetchSubmissionSlaSummary } from "@/services/api";

export function useSubmissionDetail(submissionId: number) {
  const [localSubmission, setLocalSubmission] = useState<SubmissionDetail | null>(null);

  const {
    data: detail,
    isLoading: detailLoading,
    error: detailError,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: ["submission", submissionId],
    queryFn: () => fetchSubmissionDetail(submissionId),
    enabled: Number.isFinite(submissionId) && submissionId > 0,
  });

  const {
    data: slaSummary,
    isLoading: slaLoading,
  } = useQuery({
    queryKey: ["submissionSla", submissionId],
    queryFn: () => fetchSubmissionSlaSummary(submissionId),
    enabled: Number.isFinite(submissionId) && submissionId > 0,
  });

  const submission = localSubmission ?? detail ?? null;

  return {
    submission: submission as SubmissionDetail | null,
    slaSummary: (slaSummary ?? null) as SubmissionSlaSummary | null,
    loading: detailLoading || slaLoading,
    error: detailError
      ? (detailError instanceof Error ? detailError.message : "Failed to load submission")
      : null,
    reload: () => { refetchDetail(); },
    setSubmission: setLocalSubmission,
  };
}
