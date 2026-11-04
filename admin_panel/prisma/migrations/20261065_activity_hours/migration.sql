-- Hourly activity per user (app time, app opens, video watch time) for the panel's charts.
CREATE TABLE "UserActivityHour" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT NOT NULL DEFAULT '',
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserActivityHour_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserActivityHour_userId_day_hour_kind_refId_key" ON "UserActivityHour"("userId", "day", "hour", "kind", "refId");
CREATE INDEX "UserActivityHour_day_kind_idx" ON "UserActivityHour"("day", "kind");

ALTER TABLE "UserActivityHour" ADD CONSTRAINT "UserActivityHour_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
