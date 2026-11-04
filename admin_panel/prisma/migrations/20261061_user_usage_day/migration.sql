-- Daily time each user kept the app open (shown to mentors as an activity chart).
CREATE TABLE "UserUsageDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserUsageDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserUsageDay_userId_day_key" ON "UserUsageDay"("userId", "day");
CREATE INDEX "UserUsageDay_day_idx" ON "UserUsageDay"("day");

ALTER TABLE "UserUsageDay" ADD CONSTRAINT "UserUsageDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
