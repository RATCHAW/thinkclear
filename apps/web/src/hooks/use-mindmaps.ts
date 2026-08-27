import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { components } from "@/lib/api-types";

export type Mindmap = components["schemas"]["MindmapDto"];

export const mindmapKeys = {
  all: ["mindmaps"] as const,
};

export function useMindmaps() {
  return useQuery({
    queryKey: mindmapKeys.all,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/mindmaps");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateMindmap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (title: string) => {
      const { data, error } = await api.POST("/api/mindmaps", {
        body: { title },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mindmapKeys.all });
    },
  });
}
