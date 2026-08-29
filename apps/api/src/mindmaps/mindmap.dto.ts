import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class MindmapNodeDto {
  @ApiProperty({
    example: "root",
    description:
      'Unique within the mindmap. The node with id "root" is the map\'s root and cannot be removed.',
  })
  id: string;

  @ApiProperty({ example: "Backend", minLength: 1, maxLength: 200 })
  title: string;

  @ApiProperty({
    example: 0,
    description:
      "Canvas position. The editor lays the tree out from scratch on load, so this is a hint about sibling order rather than a fixed coordinate.",
  })
  x: number;

  @ApiProperty({ example: 0 })
  y: number;

  @ApiPropertyOptional({
    example: "Ship the **API** first, then the canvas.",
    maxLength: 5000,
    description:
      "The topic's note, as markdown source. Omitted when the topic has no note — an empty string is not stored.",
  })
  note?: string;
}

export class MindmapEdgeDto {
  @ApiProperty({ description: "Unique within the mindmap" })
  id: string;

  @ApiProperty({ description: "Node id the edge starts from" })
  source: string;

  @ApiProperty({
    description:
      "Node id the edge points to. Direction is presentation only — the editor re-points edges parent to child when it lays the tree out.",
  })
  target: string;
}

export class CreateMindmapDto {
  @ApiProperty({ example: "My first mindmap" })
  title: string;
}

/**
 * At least one field is required. `nodes` and `edges` each replace the stored
 * array wholesale — send the graph you want to end up with, not a delta — and
 * whichever one is omitted is checked as it currently stands, so dropping a
 * node without also dropping the edges into it is a 400 rather than a mindmap
 * with a dangling connection.
 */
export class UpdateMindmapDto {
  @ApiPropertyOptional({
    example: "Renamed mindmap",
    minLength: 1,
    maxLength: 200,
  })
  title?: string;

  @ApiPropertyOptional({
    type: [MindmapNodeDto],
    maxItems: 500,
    description:
      'Replaces every node. Ids must be unique and one of them must be "root".',
  })
  nodes?: MindmapNodeDto[];

  @ApiPropertyOptional({
    type: [MindmapEdgeDto],
    maxItems: 1000,
    description:
      "Replaces every edge. Ids must be unique, both endpoints must be nodes of this mindmap, and the result must stay a tree: no self-connections, no node pair connected twice, and no loops. Disconnected branches are allowed.",
  })
  edges?: MindmapEdgeDto[];
}

export class MindmapDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  ownerId: string;

  @ApiProperty({ type: [MindmapNodeDto] })
  nodes: MindmapNodeDto[];

  @ApiProperty({ type: [MindmapEdgeDto] })
  edges: MindmapEdgeDto[];

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}
