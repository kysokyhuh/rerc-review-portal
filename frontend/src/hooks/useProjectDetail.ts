import { useState, useEffect, useCallback } from "react";
import type { ProjectDetail } from "@/types";
import { fetchProjectDetail } from "@/services/api";

export function useProjectDetail(projectId: number) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchProjectDetail(projectId);
      setProject(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return { project, loading, error, reload: load };
}
