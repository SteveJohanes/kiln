-- CreateEnum
CREATE TYPE "StreamEventType" AS ENUM ('chat', 'donation');

-- CreateTable
CREATE TABLE "StreamEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "platform" "Platform" NOT NULL,
    "type" "StreamEventType" NOT NULL,
    "username" TEXT NOT NULL,
    "message" TEXT,
    "amount" DOUBLE PRECISION,
    "currency" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StreamEvent_userId_idx" ON "StreamEvent"("userId");

-- CreateIndex
CREATE INDEX "StreamEvent_sessionId_idx" ON "StreamEvent"("sessionId");

-- CreateIndex
CREATE INDEX "StreamEvent_timestamp_idx" ON "StreamEvent"("timestamp");

-- AddForeignKey
ALTER TABLE "StreamEvent" ADD CONSTRAINT "StreamEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamEvent" ADD CONSTRAINT "StreamEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StreamSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
