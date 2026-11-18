CREATE TABLE `forecast_snapshots` (
  `cache_key` text PRIMARY KEY NOT NULL,
  `source` text NOT NULL CHECK (`source` IN ('open-meteo', '7timer')),
  `fetched_at` integer NOT NULL CHECK (`fetched_at` > 0),
  `payload_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `forecast_snapshots_fetched_at_idx` ON `forecast_snapshots` (`fetched_at`);
