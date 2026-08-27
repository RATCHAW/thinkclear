import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiProperty, ApiTags } from "@nestjs/swagger";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";

export class MeUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;
}

export class MeResponseDto {
  @ApiProperty({ type: MeUserDto })
  user: MeUserDto;
}

@ApiTags("me")
@Controller("api/me")
export class MeController {
  @Get()
  @ApiOkResponse({ type: MeResponseDto })
  me(@Session() session: UserSession): MeResponseDto {
    const { id, email, name } = session.user;
    return { user: { id, email, name } };
  }
}
