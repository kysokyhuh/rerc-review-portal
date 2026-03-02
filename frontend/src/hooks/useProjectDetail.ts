import { useQuery } from "@tanstack/react-query";
import type { ProjectDetail } from "@/types";
import { fetchProjectDetail } from "@/services/api";

export function useProjectDetail(projectId: number) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => fetchProjectDetail(projectId),
    enabled: Number.isFinite(projectId) && projectId > 0,
  });

  return {
    project: (data ?? null) as ProjectDetail | null,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to load project") : null,
    reload: () => { refetch(); },
  };
}
