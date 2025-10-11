#!/usr/bin/env php
<?php
// Reset SQLite DB from db/reset.sql and remove contents under public/m/
// Usage: php scripts/reset_db_and_clean.php [--dry-run] [--yes]

declare(strict_types=1);

$cwd = dirname(__DIR__);
$dbFile = $cwd . '/db/cdn.sqlite';
$sqlFile = $cwd . '/db/reset.sql';
$mDir = $cwd . '/public/m';

$dryRun = false;
$assumeYes = false;

foreach ($argv as $i => $arg) {
    if ($i === 0) continue;
    if ($arg === '--dry-run') $dryRun = true;
    if ($arg === '--yes' || $arg === '-y') $assumeYes = true;
    if ($arg === '--help' || $arg === '-h') {
        echo "Usage: php {$argv[0]} [--dry-run] [--yes]\n";
        exit(0);
    }
}

if (!file_exists($sqlFile)) {
    fwrite(STDERR, "SQL file not found: $sqlFile\n");
    exit(1);
}

if ($dryRun) {
    echo "DRY RUN: would run SQL file: $sqlFile on DB: $dbFile\n";
    echo "DRY RUN: would remove contents under: $mDir\n";
    exit(0);
}

if (!file_exists($dbFile)) {
    echo "DB file does not exist: $dbFile\n";
    if (!$assumeYes) {
        echo "Create new DB file and apply reset.sql? [y/N] ";
        $resp = trim(fgets(STDIN));
        if (!preg_match('/^[Yy]/', $resp)) {
            echo "Aborting.\n";
            exit(1);
        }
    }
}

if (!$assumeYes) {
    echo "About to reset DB ($dbFile) using $sqlFile and remove contents under $mDir\n";
    echo "Proceed? [y/N] ";
    $resp = trim(fgets(STDIN));
    if (!preg_match('/^[Yy]/', $resp)) {
        echo "Aborting.\n";
        exit(1);
    }
}

// backup
$backup = $dbFile . '.' . gmdate('Ymd\THis\Z') . '.bak';
if (file_exists($dbFile)) {
    if (!@copy($dbFile, $backup)) {
        fwrite(STDERR, "Failed to create backup $backup\n");
        exit(1);
    }
    echo "Backup created: $backup\n";
}

echo "Applying SQL...\n";
$sql = file_get_contents($sqlFile);
if ($sql === false) {
    fwrite(STDERR, "Failed reading $sqlFile\n");
    exit(1);
}

try {
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    // The provided reset.sql may contain its own BEGIN/COMMIT statements. Execute
    // the SQL directly without wrapping in an extra transaction to avoid
    // "cannot start a transaction within a transaction" errors.
    $pdo->exec($sql);
} catch (Throwable $e) {
    fwrite(STDERR, "DB reset failed: " . $e->getMessage() . "\n");
    exit(1);
}

if (is_dir($mDir)) {
    echo "Removing contents under $mDir\n";
    $it = new DirectoryIterator($mDir);
    foreach ($it as $item) {
        if ($item->isDot()) continue;
        $path = $item->getPathname();
        // recursively remove
        $cmd = sprintf('rm -rf %s', escapeshellarg($path));
        system($cmd, $rc);
        if ($rc !== 0) {
            fwrite(STDERR, "Failed removing $path\n");
        }
    }
} else {
    echo "Directory $mDir does not exist; nothing to remove\n";
}

echo "Done. DB reset and public/m/ cleaned. Backup at: $backup\n";
