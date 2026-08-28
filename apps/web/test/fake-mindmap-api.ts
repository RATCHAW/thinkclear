import type { Mindmap } from "@/hooks/use-mindmaps";

type MindmapPatch = Partial<Pick<Mindmap, "title" | "nodes" | "edges">>;

export function createFakeMindmapApi(initialMindmaps: Mindmap[] = []) {
  let mindmaps = structuredClone(initialMindmaps);
  let sequence = mindmaps.length;
  const graphPatches: MindmapPatch[] = [];

  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const { pathname } = new URL(request.url);
    const id = pathname.startsWith("/api/mindmaps/")
      ? decodeURIComponent(pathname.slice("/api/mindmaps/".length))
      : null;

    if (pathname === "/api/mindmaps" && request.method === "GET") {
      return json(mindmaps);
    }

    if (pathname === "/api/mindmaps" && request.method === "POST") {
      const body = (await request.json()) as { title: string };
      sequence += 1;
      const now = new Date().toISOString();
      const created: Mindmap = {
        _id: `mindmap-${sequence}`,
        ownerId: "user-1",
        title: body.title,
        nodes: [{ id: "root", title: body.title, x: 0, y: 0 }],
        edges: [],
        createdAt: now,
        updatedAt: now,
      };
      mindmaps = [created, ...mindmaps];
      return json(created, 201);
    }

    if (id && request.method === "PATCH") {
      const body = (await request.json()) as MindmapPatch;
      if (body.nodes || body.edges) graphPatches.push(structuredClone(body));
      const index = mindmaps.findIndex((mindmap) => mindmap._id === id);
      if (index === -1) return json({ message: "Mindmap not found" }, 404);
      const updated = {
        ...mindmaps[index],
        ...body,
        updatedAt: new Date().toISOString(),
      };
      mindmaps = mindmaps.map((mindmap, current) =>
        current === index ? updated : mindmap,
      );
      return json(updated);
    }

    if (id && request.method === "DELETE") {
      const exists = mindmaps.some((mindmap) => mindmap._id === id);
      if (!exists) return json({ message: "Mindmap not found" }, 404);
      mindmaps = mindmaps.filter((mindmap) => mindmap._id !== id);
      return new Response(null, { status: 204 });
    }

    return json({ message: `Unhandled ${request.method} ${pathname}` }, 500);
  };

  return {
    fetch,
    graphPatches,
    mindmaps: () => structuredClone(mindmaps),
  };
}

export function mindmapFixture(overrides: Partial<Mindmap> = {}): Mindmap {
  return {
    _id: "mindmap-1",
    ownerId: "user-1",
    title: "Roadmap",
    nodes: [{ id: "root", title: "Roadmap", x: 0, y: 0 }],
    edges: [],
    createdAt: "2026-08-28T10:00:00.000Z",
    updatedAt: "2026-08-28T10:00:00.000Z",
    ...overrides,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
