-- AlterTable
ALTER TABLE "AdSlot" ADD COLUMN "gamAdUnitCode" TEXT;
ALTER TABLE "AdSlot" ADD COLUMN "gamAdUnitId" TEXT;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "gamCreativeId" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "gamLineItemId" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "gamOrderId" TEXT;

-- CreateTable
CREATE TABLE "GamConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "networkCode" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "tokenExpiry" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "GamConnection_shop_key" ON "GamConnection"("shop");
