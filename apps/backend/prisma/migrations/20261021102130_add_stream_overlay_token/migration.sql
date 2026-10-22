-- CreateTable
CREATE TABLE "StreamOverlayToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "StreamOverlayToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StreamOverlayToken_tokenHash_key" ON "StreamOverlayToken"("tokenHash");

-- CreateIndex
CREATE INDEX "StreamOverlayToken_userId_idx" ON "StreamOverlayToken"("userId");

-- CreateIndex
CREATE INDEX "StreamOverlayToken_sessionId_idx" ON "StreamOverlayToken"("sessionId");

-- CreateIndex
CREATE INDEX "StreamOverlayToken_userId_sessionId_idx" ON "StreamOverlayToken"("userId", "sessionId");

-- AddForeignKey
ALTER TABLE "StreamOverlayToken" ADD CONSTRAINT "StreamOverlayToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamOverlayToken" ADD CONSTRAINT "StreamOverlayToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StreamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
