import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import {
  createMindmapSchema,
  updateMindmapSchema,
  CreateMindmapInput,
  UpdateMindmapInput,
} from "@mindmap/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CreateMindmapDto, MindmapDto, UpdateMindmapDto } from "./mindmap.dto";
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

  @Get(":id")
  @ApiOkResponse({ type: MindmapDto })
  @ApiNotFoundResponse()
  findOne(@Session() session: UserSession, @Param("id") id: string) {
    return this.mindmapsService.findOne(session.user.id, id);
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

  @Patch(":id")
  @ApiBody({ type: UpdateMindmapDto })
  @ApiOkResponse({ type: MindmapDto })
  @ApiNotFoundResponse()
  update(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateMindmapSchema))
    body: UpdateMindmapInput,
  ) {
    return this.mindmapsService.update(session.user.id, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  remove(@Session() session: UserSession, @Param("id") id: string) {
    return this.mindmapsService.remove(session.user.id, id);
  }
}
