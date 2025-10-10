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
        // enable foreign keys
        $this->pdo->exec('PRAGMA foreign_keys = ON');

        if ($init) {
            $this->initSchema();
        } else {
            // migrate schema if needed (adds projects table and project_id column)
            $this->migrateSchema();
        }
    }

    private function initSchema(): void
    {
                $sql = <<<SQL
CREATE TABLE IF NOT EXISTS projects (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media (
    id            TEXT PRIMARY KEY,
    kind          TEXT NOT NULL,
    project       TEXT,
    project_id    TEXT REFERENCES projects(id) ON DELETE SET NULL,
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
CREATE INDEX IF NOT EXISTS idx_media_project_id ON media(project_id);
SQL;
        $this->pdo->exec($sql);
    }

        /**
         * Migrate existing schema: create projects table if missing, add project_id column to media
         * and populate projects from existing media.project values.
         */
        private function migrateSchema(): void
        {
                // create projects table if it doesn't exist
                $this->pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS projects (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
SQL
                );

                // check if media has project_id column
                $stmt = $this->pdo->query("PRAGMA table_info(media)");
                $cols = $stmt->fetchAll(PDO::FETCH_ASSOC);
                $hasProjectId = false;
                foreach ($cols as $c) {
                        if (isset($c['name']) && $c['name'] === 'project_id') { $hasProjectId = true; break; }
                }

                if (!$hasProjectId) {
                        // Add column (SQLite supports ADD COLUMN)
                        $this->pdo->exec("ALTER TABLE media ADD COLUMN project_id TEXT");
                        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_media_project_id ON media(project_id)");

                        // For each distinct existing project value, create a project row and link
                        $distinct = $this->pdo->query("SELECT DISTINCT project FROM media WHERE project IS NOT NULL AND project != ''")->fetchAll(PDO::FETCH_COLUMN);
                        $insertProject = $this->pdo->prepare('INSERT OR IGNORE INTO projects (id,name) VALUES (:id,:name)');
                        $selectProject = $this->pdo->prepare('SELECT id FROM projects WHERE name = :name');
                        $updateMedia = $this->pdo->prepare('UPDATE media SET project_id = :pid WHERE project = :name');

                        foreach ($distinct as $projName) {
                                // check if project already exists
                                $selectProject->execute([':name'=>$projName]);
                                $row = $selectProject->fetch(PDO::FETCH_ASSOC);
                                if ($row && isset($row['id'])) {
                                        $pid = $row['id'];
                                } else {
                                        $pid = bin2hex(random_bytes(8));
                                        $insertProject->execute([':id'=>$pid, ':name'=>$projName]);
                                }
                                $updateMedia->execute([':pid'=>$pid, ':name'=>$projName]);
                        }
                }
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
