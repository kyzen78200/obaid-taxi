-- ============================================================
-- 008 — Notifications
-- ============================================================

-- Expo push tokens (mobile clients)
CREATE TABLE IF NOT EXISTS push_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  token      text NOT NULL,
  platform   text, -- 'ios' | 'android'
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Web push subscriptions (chauffeur web)
CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   text NOT NULL,
  p256dh     text NOT NULL,
  auth_key   text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(driver_id, endpoint)
);

-- Notification preferences — clients
CREATE TABLE IF NOT EXISTS notification_preferences (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  -- push
  push_booking_status   boolean DEFAULT true,
  push_driver_assigned  boolean DEFAULT true,
  push_reminder_1h      boolean DEFAULT true,
  push_reminder_15min   boolean DEFAULT true,
  push_driver_en_route  boolean DEFAULT true,
  push_booking_cancelled boolean DEFAULT true,
  push_loyalty_milestone boolean DEFAULT true,
  -- email
  email_booking_confirmed  boolean DEFAULT true,
  email_reminder_day_before boolean DEFAULT true,
  email_booking_recap      boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

-- Notification preferences — drivers
CREATE TABLE IF NOT EXISTS driver_notification_preferences (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  -- push
  push_new_broadcast  boolean DEFAULT true,
  push_assigned       boolean DEFAULT true,
  push_cancelled      boolean DEFAULT true,
  push_reminder_30min boolean DEFAULT true,
  push_account_status boolean DEFAULT true,
  -- email
  email_welcome          boolean DEFAULT true,
  email_account_approved boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

-- In-app notifications (admin)
CREATE TABLE IF NOT EXISTS admin_notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL, -- 'new_booking' | 'booking_cancelled' | 'unassigned_urgent' | 'no_show' | 'new_driver' | 'broadcast_timeout'
  title      text NOT NULL,
  body       text NOT NULL,
  data       jsonb,
  read       boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push tokens"
  ON push_tokens FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Drivers manage own web push"
  ON web_push_subscriptions FOR ALL USING (auth.uid() = driver_id);

CREATE POLICY "Users manage own notif prefs"
  ON notification_preferences FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Drivers manage own notif prefs"
  ON driver_notification_preferences FOR ALL USING (auth.uid() = driver_id);

-- Admin peut lire ses notifs (via service role depuis l'API)
-- Service role bypasse RLS automatiquement

-- Index
CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread ON admin_notifications(read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_web_push_driver ON web_push_subscriptions(driver_id);
