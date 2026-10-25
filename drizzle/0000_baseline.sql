CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`x_user_id` text NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`access_token_enc` text NOT NULL,
	`refresh_token_enc` text,
	`expires_at` integer NOT NULL,
	`scopes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_error` text,
	`is_default` integer DEFAULT false NOT NULL,
	`premium` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_x_user_id_unique` ON `accounts` (`x_user_id`);--> statement-breakpoint
CREATE TABLE `api_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts` integer NOT NULL,
	`account_id` text,
	`post_id` text,
	`op` text NOT NULL,
	`units` integer DEFAULT 1 NOT NULL,
	`cost_usd` real NOT NULL
);
--> statement-breakpoint
CREATE INDEX `api_ledger_ts_idx` ON `api_ledger` (`ts`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`original_name` text NOT NULL,
	`mime` text NOT NULL,
	`kind` text NOT NULL,
	`size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`duration_ms` integer,
	`thumb_filename` text,
	`alt_text` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`state` text PRIMARY KEY NOT NULL,
	`code_verifier` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `post_item_media` (
	`item_id` text NOT NULL,
	`media_id` text NOT NULL,
	`position` integer NOT NULL,
	`alt_text` text DEFAULT '' NOT NULL,
	PRIMARY KEY(`item_id`, `position`),
	FOREIGN KEY (`item_id`) REFERENCES `post_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `pim_media_idx` ON `post_item_media` (`media_id`);--> statement-breakpoint
CREATE TABLE `post_items` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`position` integer NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`poll` text,
	`x_post_id` text,
	`published_at` integer,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_items_pos_idx` ON `post_items` (`post_id`,`position`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`status` text NOT NULL,
	`scheduled_at` integer,
	`queued` integer DEFAULT false NOT NULL,
	`options` text DEFAULT '{}' NOT NULL,
	`recur_freq` text,
	`recur_interval` integer DEFAULT 1 NOT NULL,
	`recur_until` integer,
	`series_id` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer,
	`lease_until` integer,
	`last_error` text,
	`error_kind` text,
	`published_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `posts_status_sched_idx` ON `posts` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `posts_account_idx` ON `posts` (`account_id`,`status`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`user_agent` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE TABLE `queue_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`weekday` integer NOT NULL,
	`minutes` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `queue_slots_unique_idx` ON `queue_slots` (`account_id`,`weekday`,`minutes`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`user_agent` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`created_at` integer NOT NULL,
	`password_changed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);