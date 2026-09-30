import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UserPersistenceService } from "./user-persistence.service";

@Module({
  providers: [
    PrismaService,
    UserPersistenceService,
  ],
  exports: [UserPersistenceService],
})
export class UserModule {}
