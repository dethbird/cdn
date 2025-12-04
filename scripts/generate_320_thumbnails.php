<?php
/**
 * Migration script to generate 320px thumbnails from existing 1200px images.
 * 
 * This script:
 * 1. Finds all image media records that have url_1200 but no url_320
 * 2. Loads the 1200px WebP file
 * 3. Resizes it to 320px max dimension (no upscaling)
 * 4. Saves as WebP preserving alpha transparency
 * 5. Updates the database with the new url_320
 * 
 * Usage: php scripts/generate_320_thumbnails.php
 */

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;

// Load environment
if (file_exists(__DIR__ . '/../.env')) {
    $dotenv = Dotenv::createImmutable(__DIR__ . '/..');
    $dotenv->load();
}

$dbPath = __DIR__ . '/../db/cdn.sqlite';
if (!file_exists($dbPath)) {
    echo "Database not found at: $dbPath\n";
    exit(1);
}

$pdo = new PDO('sqlite:' . $dbPath);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// First, add the url_320 column if it doesn't exist
try {
    $pdo->exec('ALTER TABLE media ADD COLUMN url_320 TEXT');
    echo "Added url_320 column to media table.\n";
} catch (PDOException $e) {
    // Column likely already exists
    if (strpos($e->getMessage(), 'duplicate column') === false && strpos($e->getMessage(), 'already exists') === false) {
        echo "Note: url_320 column may already exist or error: " . $e->getMessage() . "\n";
    }
}

// Find all images with url_1200 but missing url_320
$stmt = $pdo->query("SELECT id, url_1200 FROM media WHERE kind = 'image' AND url_1200 IS NOT NULL AND (url_320 IS NULL OR url_320 = '')");
$images = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($images)) {
    echo "No images found that need 320px thumbnails.\n";
    exit(0);
}

echo "Found " . count($images) . " images to process.\n";

$baseUrl = rtrim($_ENV['BASE_URL'] ?? '', '/');
$publicDir = __DIR__ . '/../public';

$processed = 0;
$errors = 0;

foreach ($images as $img) {
    $id = $img['id'];
    $url1200 = $img['url_1200'];
    
    // Determine the source file path from url_1200
    // URL format: {BASE_URL}/m/i/{id}/{id}-1200.webp
    $srcPath = $publicDir . "/m/i/{$id}/{$id}-1200.webp";
    
    if (!file_exists($srcPath)) {
        echo "  [SKIP] $id: Source file not found: $srcPath\n";
        $errors++;
        continue;
    }
    
    $outPath = $publicDir . "/m/i/{$id}/{$id}-320.webp";
    
    try {
        $im = new Imagick($srcPath);
        
        // Preserve alpha channel for WebP
        if ($im->getImageAlphaChannel()) {
            $im->setImageAlphaChannel(Imagick::ALPHACHANNEL_ACTIVATE);
        }
        
        $width = $im->getImageWidth();
        $height = $im->getImageHeight();
        $max = 320;
        
        // Only downscale — do not upscale
        if ($width > $max || $height > $max) {
            if ($width >= $height) {
                $im->resizeImage($max, 0, Imagick::FILTER_LANCZOS, 1);
            } else {
                $im->resizeImage(0, $max, Imagick::FILTER_LANCZOS, 1);
            }
        }
        
        $im->setImageFormat('webp');
        $im->setImageCompressionQuality(85);
        $im->writeImage($outPath);
        $im->clear();
        
        // Build the URL for url_320
        $url320 = $baseUrl . "/m/i/{$id}/{$id}-320.webp";
        
        // Update database
        $updateStmt = $pdo->prepare('UPDATE media SET url_320 = :url WHERE id = :id');
        $updateStmt->execute([':url' => $url320, ':id' => $id]);
        
        echo "  [OK] $id: Created 320px thumbnail\n";
        $processed++;
        
    } catch (Exception $e) {
        echo "  [ERROR] $id: " . $e->getMessage() . "\n";
        $errors++;
    }
}

echo "\nDone! Processed: $processed, Errors: $errors\n";
