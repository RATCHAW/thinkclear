import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateMindmapDto {
  @ApiProperty({ example: "My first mindmap" })
  title: string;
}

export class UpdateMindmapDto {
  @ApiPropertyOptional({ example: "Renamed mindmap" })
  title?: string;
}

export class MindmapDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  ownerId: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}
