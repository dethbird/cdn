<?php
declare(strict_types=1);

namespace App;

use PDO;

final class Db
{
    private PDO $pdo;

    public function __construct(string $path)
    {
        $dir = dirname($path);
        if (!is_dir($dir)) mkdir($dir, 0775, true);
        $init = !file_exists($path);
        $this->pdo = new PDO('sqlite:' . $path, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        if ($init) $this->initSchema();
    }

    private function initSchema(): void
    {
        $sql = <<<SQL
CREATE TABLE IF NOT EXISTS media (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL,
  project       TEXT,
  title         TEXT,
  src_mime      TEXT NOT NULL,
  ext           TEXT NOT NULL,
  width         INTEGER,
  height        INTEGER,
  duration_sec  REAL,
  bytes         INTEGER NOT NULL,
  sha256        TEXT NOT NULL,
  url_main      TEXT NOT NULL,
  url_1200      TEXT,
  url_800       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_media_project ON media(project);
SQL;
        $this->pdo->exec($sql);
    }

    public function pdo(): PDO { return $this->pdo; }

    public function insert(string $table, array $row): void
    {
        $cols = array_keys($row);
        $place = array_map(fn($c)=>":$c", $cols);
        $sql = "INSERT INTO $table (" . implode(',', $cols) . ") VALUES (" . implode(',', $place) . ")";
        $stmt = $this->pdo->prepare($sql);
        foreach ($row as $k=>$v) $stmt->bindValue(":$k", $v);
        $stmt->execute();
    }
}
