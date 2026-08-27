import { Body, Controller, Get, Post } from "@nestjs/common";
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import { createMindmapSchema, CreateMindmapInput } from "@mindmap/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CreateMindmapDto, MindmapDto } from "./mindmap.dto";
import { MindmapsService } from "./mindmaps.service";

@ApiTags("mindmaps")
@Controller("api/mindmaps")
export class MindmapsController {
  constructor(private readonly mindmapsService: MindmapsService) {}

  @Get()
  @ApiOkResponse({ type: [MindmapDto] })
  findMine(@Session() session: UserSession) {
    return this.mindmapsService.findAllByOwner(session.user.id);
  }

  @Post()
  @ApiBody({ type: CreateMindmapDto })
  @ApiCreatedResponse({ type: MindmapDto })
  create(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(createMindmapSchema))
    body: CreateMindmapInput,
  ) {
    return this.mindmapsService.create(session.user.id, body.title);
  }
}
