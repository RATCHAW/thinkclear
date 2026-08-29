import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { components } from "@/lib/api-types";

/** A row in the history list — the server projects the messages away. */
export type ConversationSummary =
  components["schemas"]["ConversationSummaryDto"];
/** One conversation with its stored AI SDK messages. */
export type Conversation = components["schemas"]["ConversationDto"];

/**
 * `list` and `detail` are deliberately siblings rather than parent and child.
 * Every finished chat turn invalidates the list so titles and ordering catch
 * up; if the open conversation's detail sat under that prefix it would refetch
 * on the same beat and race the live `useChat` messages back to the server's
 * copy.
 */
export const conversationKeys = {
  list: ["conversations", "list"] as const,
  detail: (id: string) => ["conversations", "detail", id] as const,
};

export function useConversations() {
  return useQuery({
    queryKey: conversationKeys.list,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/conversations");
      if (error) throw error;
      return data;
    },
  });
}

/** Fetches one conversation's stored messages. Idle while nothing is open. */
export function useConversation(id: string | null) {
  return useQuery({
    queryKey: conversationKeys.detail(id ?? ""),
    enabled: id !== null,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/conversations/{id}", {
        params: { path: { id: id! } },
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (title: string) => {
      const { data, error } = await api.POST("/api/conversations", {
        body: { title },
      });
      // A 201 always carries the created conversation — `data` is optional in
      // the generated types only because the route can also answer 400.
      if (error || !data)
        throw error ?? new Error("Create returned no conversation");
      return data;
    },
    onSuccess: (created) => {
      // Seeded rather than invalidated: the caller is about to send its first
      // message into this conversation, and the history list should already
      // have the row when it does.
      queryClient.setQueryData(conversationKeys.detail(created._id), created);
      void queryClient.invalidateQueries({ queryKey: conversationKeys.list });
    },
  });
}

/** Optimistic, for the same reason renaming a mindmap is. */
export function useRenameConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { data, error } = await api.PATCH("/api/conversations/{id}", {
        params: { path: { id } },
        body: { title },
      });
      if (error) throw error;
      return data;
    },
    onMutate: ({ id, title }) =>
      patchList(queryClient, (list) =>
        list.map((conversation) =>
          conversation._id === id ? { ...conversation, title } : conversation,
        ),
      ),
    onError: (_error, _variables, context) => restoreList(queryClient, context),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: conversationKeys.list });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE("/api/conversations/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onMutate: (id) =>
      patchList(queryClient, (list) =>
        list.filter((conversation) => conversation._id !== id),
      ),
    onError: (_error, _variables, context) => restoreList(queryClient, context),
    onSettled: (_data, _error, id) => {
      queryClient.removeQueries({ queryKey: conversationKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: conversationKeys.list });
    },
  });
}

type ListSnapshot = { previous: ConversationSummary[] | undefined };

/**
 * Cancels any in-flight list fetch first — otherwise a refetch that started
 * before the mutation can land after it and paint the pre-mutation list back
 * over the optimistic one.
 */
async function patchList(
  queryClient: QueryClient,
  update: (list: ConversationSummary[]) => ConversationSummary[],
): Promise<ListSnapshot> {
  await queryClient.cancelQueries({ queryKey: conversationKeys.list });
  const previous = queryClient.getQueryData<ConversationSummary[]>(
    conversationKeys.list,
  );
  queryClient.setQueryData<ConversationSummary[]>(
    conversationKeys.list,
    (list) => (list ? update(list) : list),
  );
  return { previous };
}

function restoreList(
  queryClient: QueryClient,
  context: ListSnapshot | undefined,
) {
  if (context?.previous) {
    queryClient.setQueryData(conversationKeys.list, context.previous);
  }
}
