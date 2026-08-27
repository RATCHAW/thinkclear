import { Background, Controls, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// Placeholder proving React Flow is wired into the web build.
// The real mindmap editor comes later.
export function MindmapCanvas() {
  return (
    <div className="h-full w-full">
      <ReactFlow nodes={[]} edges={[]} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
