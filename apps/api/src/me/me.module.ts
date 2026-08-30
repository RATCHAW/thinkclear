import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MeController } from "./me.controller";
import { MeService } from "./me.service";
import { Preferences, PreferencesSchema } from "./preferences.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Preferences.name, schema: PreferencesSchema },
    ]),
  ],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
