-- MEDIA: one row per uploaded item (original)
CREATE TABLE media (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id         VARCHAR(24) NOT NULL,

  owner_user_id     BIGINT UNSIGNED NULL,
  type              ENUM('image','audio','video') NOT NULL,

  original_filename VARCHAR(255) NULL,
  original_ext      VARCHAR(16) NULL,
  mime_type         VARCHAR(127) NULL,

  bytes             BIGINT UNSIGNED NULL,
  sha256            BINARY(32) NULL,

  width             INT UNSIGNED NULL,
  height            INT UNSIGNED NULL,
  duration_ms       INT UNSIGNED NULL,

  status            ENUM('uploaded','processing','ready','failed','deleted')
                    NOT NULL DEFAULT 'uploaded',

  title             VARCHAR(255) NULL,
  caption           TEXT NULL,
  alt_text          VARCHAR(512) NULL,

  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  UNIQUE KEY uq_media_public_id (public_id),
  KEY ix_media_type_created (type, created_at),
  KEY ix_media_owner_created (owner_user_id, created_at),

  CONSTRAINT fk_media_user
    FOREIGN KEY (owner_user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- MEDIA ASSET: derivatives/transcodes (renditions)
CREATE TABLE media_asset (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  media_id      BIGINT UNSIGNED NOT NULL,

  variant       VARCHAR(32) NOT NULL,
  format        VARCHAR(16) NOT NULL,
  bytes         BIGINT UNSIGNED NULL,

  width         INT UNSIGNED NULL,
  height        INT UNSIGNED NULL,
  duration_ms   INT UNSIGNED NULL,

  path          VARCHAR(1024) NOT NULL,
  sha256        BINARY(32) NULL,

  status        ENUM('queued','processing','ready','failed')
                NOT NULL DEFAULT 'queued',

  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                              ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  UNIQUE KEY uq_media_variant_format (media_id, variant, format),
  KEY ix_media_asset_status (status),

  CONSTRAINT fk_media_asset_media
    FOREIGN KEY (media_id) REFERENCES media(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- COLLECTION: albums/stacks
CREATE TABLE collection (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id     VARCHAR(24) NOT NULL,
  owner_user_id BIGINT UNSIGNED NULL,

  kind          ENUM('album','stack') NOT NULL,
  title         VARCHAR(255) NOT NULL,
  description   TEXT NULL,

  visibility    ENUM('private','unlisted','public') NOT NULL DEFAULT 'private',

  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                              ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  UNIQUE KEY uq_collection_public_id (public_id),
  KEY ix_collection_owner_kind (owner_user_id, kind),

  CONSTRAINT fk_collection_user
    FOREIGN KEY (owner_user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- COLLECTION ITEM: membership + ordering
CREATE TABLE collection_item (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  collection_id  BIGINT UNSIGNED NOT NULL,
  media_id       BIGINT UNSIGNED NOT NULL,

  position       INT NOT NULL,
  note           VARCHAR(255) NULL,

  created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  UNIQUE KEY uq_collection_media (collection_id, media_id),
  KEY ix_collection_position (collection_id, position),
  KEY ix_media_collections (media_id),

  CONSTRAINT fk_collection_item_collection
    FOREIGN KEY (collection_id) REFERENCES collection(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_collection_item_media
    FOREIGN KEY (media_id) REFERENCES media(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
