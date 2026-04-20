-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "productImageUrl" TEXT NOT NULL,
    "productPrice" TEXT NOT NULL,
    "productUrl" TEXT,
    "bannerUrl" TEXT,
    "template" TEXT NOT NULL DEFAULT 'spotlight',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startAt" DATETIME,
    "endAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
