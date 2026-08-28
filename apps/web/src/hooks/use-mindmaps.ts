import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { useUiStore } from "@/stores/ui-store";

export type Mindmap = components["schemas"]["MindmapDto"];
export type MindmapNode = components["schemas"]["MindmapNodeDto"];
export type MindmapEdge = components["schemas"]["MindmapEdgeDto"];

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

/**
 * The single place the selected id is resolved against real data. Deleting the
 * open mindmap therefore needs no cleanup anywhere — the id stops matching and
 * the app falls back to the empty state on its own.
 */
export function useActiveMindmap(): Mindmap | null {
  const selectedMindmapId = useUiStore((state) => state.selectedMindmapId);
  const { data } = useMindmaps();
  if (!selectedMindmapId) return null;
  return data?.find((mindmap) => mindmap._id === selectedMindmapId) ?? null;
}

export function useCreateMindmap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (title: string) => {
      const { data, error } = await api.POST("/api/mindmaps", {
        body: { title },
      });
      // A 201 always carries the created mindmap — `data` is optional in the
      // generated types only because the route can also answer 400.
      if (error || !data) throw error ?? new Error("Create returned no mindmap");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mindmapKeys.all });
    },
  });
}

/**
 * Renaming is optimistic. A rename is a one-field edit the user already
 * committed to by pressing Enter, and a round-trip's worth of stale title is
 * long enough to read as lag; on failure the previous list is put back and the
 * refetch in `onSettled` has the last word.
 */
export function useUpdateMindmap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { data, error } = await api.PATCH("/api/mindmaps/{id}", {
        params: { path: { id } },
        body: { title },
      });
      if (error) throw error;
      return data;
    },
    onMutate: ({ id, title }) =>
      patchList(queryClient, (list) =>
        list.map((mindmap) =>
          mindmap._id === id ? { ...mindmap, title } : mindmap,
        ),
      ),
    onError: (_error, _variables, context) => restoreList(queryClient, context),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mindmapKeys.all });
    },
  });
}

/**
 * Persists the canvas graph. Fired by a debounced autosave, so instead of the
 * rename flow's optimistic patch + invalidate (which would refetch the whole
 * list on every pause in editing) the server's response is written straight
 * into the list cache — it is the authoritative post-save document anyway.
 */
export function useSaveMindmapGraph() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      nodes: MindmapNode[];
      edges: MindmapEdge[];
      title?: string;
    }) => {
      const { data, error } = await api.PATCH("/api/mindmaps/{id}", {
        params: { path: { id } },
        body,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (updated) => {
      if (!updated) return;
      queryClient.setQueryData<Mindmap[]>(mindmapKeys.all, (list) =>
        list?.map((mindmap) =>
          mindmap._id === updated._id ? updated : mindmap,
        ),
      );
    },
  });
}

export function useDeleteMindmap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE("/api/mindmaps/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onMutate: (id) =>
      patchList(queryClient, (list) =>
        list.filter((mindmap) => mindmap._id !== id),
      ),
    onError: (_error, _variables, context) => restoreList(queryClient, context),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mindmapKeys.all });
    },
  });
}

type ListSnapshot = { previous: Mindmap[] | undefined };

/**
 * Cancels any in-flight list fetch first — otherwise a refetch that started
 * before the mutation can land after it and paint the pre-mutation list back
 * over the optimistic one.
 */
async function patchList(
  queryClient: QueryClient,
  update: (list: Mindmap[]) => Mindmap[],
): Promise<ListSnapshot> {
  await queryClient.cancelQueries({ queryKey: mindmapKeys.all });
  const previous = queryClient.getQueryData<Mindmap[]>(mindmapKeys.all);
  queryClient.setQueryData<Mindmap[]>(mindmapKeys.all, (list) =>
    list ? update(list) : list,
  );
  return { previous };
}

function restoreList(queryClient: QueryClient, context: ListSnapshot | undefined) {
  if (context?.previous) {
    queryClient.setQueryData(mindmapKeys.all, context.previous);
  }
}
