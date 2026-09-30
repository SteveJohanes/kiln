
/*
  Warnings:

  - The `platforms` column on the `StreamSession` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `status` on the `StreamSession` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('youtube', 'tiktok', 'twitch', 'kick');

-- CreateEnum
CREATE TYPE "StreamSessionStatus" AS ENUM ('idle', 'live', 'ended');

-- AlterTable
ALTER TABLE "StreamSession" DROP COLUMN "status",
ADD COLUMN     "status" "StreamSessionStatus" NOT NULL,
DROP COLUMN "platforms",
ADD COLUMN     "platforms" "Platform"[];
