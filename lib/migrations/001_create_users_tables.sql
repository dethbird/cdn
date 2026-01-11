-- USERS: one row per person in your system
CREATE TABLE users (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email             VARCHAR(320) NULL,
  email_normalized  VARCHAR(320) NULL,

  display_name      VARCHAR(255) NULL,
  avatar_url        VARCHAR(2048) NULL,

  status            ENUM('active','disabled','deleted') NOT NULL DEFAULT 'active',

  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                  ON UPDATE CURRENT_TIMESTAMP(3),
  last_login_at     DATETIME(3) NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email_norm (email_normalized)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- USER IDENTITIES: one row per OAuth identity (provider account)
CREATE TABLE user_identities (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id              BIGINT UNSIGNED NOT NULL,

  provider             ENUM('google','github','apple','microsoft','oidc') NOT NULL,
  provider_user_id     VARCHAR(255) NOT NULL,

  provider_email       VARCHAR(320) NULL,
  provider_email_norm  VARCHAR(320) NULL,

  profile_json         JSON NULL,
  created_at           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                       ON UPDATE CURRENT_TIMESTAMP(3),
  last_login_at        DATETIME(3) NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_provider_identity (provider, provider_user_id),
  KEY ix_provider_email_norm (provider_email_norm),

  CONSTRAINT fk_user_identities_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
