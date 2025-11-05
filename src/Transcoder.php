<?php
declare(strict_types=1);

namespace App;

final class Transcoder
{
    public function imageToRenditions(string $src, string $dir, string $id, callable $baseUrl): array
    {
        if (!extension_loaded('imagick')) {
            throw new \RuntimeException('Imagick not installed');
        }
        $im = new \Imagick($src);
        // Only set colorspace if the image doesn't have transparency
        if (!$im->getImageAlphaChannel()) {
            $im->setImageColorspace(\Imagick::COLORSPACE_SRGB);
        }
        $im = $im->coalesceImages();
        $maxes = [1200, 800];
        $urls = [];
        $bytesTotal = 0;
        $w1200=$h1200=$w800=$h800=0;

        foreach ($maxes as $max) {
            $frame = $im->getImage();
            $frame->stripImage();
            $frame->setImageCompressionQuality(85);
            
            // Preserve alpha channel for WebP
            if ($frame->getImageAlphaChannel()) {
                $frame->setImageAlphaChannel(\Imagick::ALPHACHANNEL_ACTIVATE);
            }
            
            $width = $frame->getImageWidth();
            $height= $frame->getImageHeight();
            if ($width >= $height) {
                if ($width > $max) $frame->resizeImage($max, 0, \Imagick::FILTER_LANCZOS, 1);
            } else {
                if ($height > $max) $frame->resizeImage(0, $max, \Imagick::FILTER_LANCZOS, 1);
            }
            // output WebP renditions
            $out = "$dir/{$id}-$max.webp";
            // ensure webp format
            $frame->setImageFormat('webp');
            // write webp
            $frame->writeImage($out);
            $bytesTotal += filesize($out);
            // point to image namespace under /m/i/<id>/
            $urls[(string)$max] = rtrim($baseUrl(),'/')."/m/i/$id/{$id}-$max.webp";
            if ($max === 1200) { $w1200 = $frame->getImageWidth(); $h1200 = $frame->getImageHeight(); }
            if ($max === 800)  { $w800  = $frame->getImageWidth(); $h800  = $frame->getImageHeight(); }
            $frame->clear();
        }
        $im->clear();
        return [$w1200,$h1200,$w800,$h800,$bytesTotal,$urls];
    }

    public function audioToMp3(string $src, string $dir, string $id): array
    {
        $out = "$dir/{$id}.mp3";
        $cmd = sprintf("ffmpeg -y -v error -i %s -vn -acodec libmp3lame -q:a 3 %s",
                       escapeshellarg($src), escapeshellarg($out));
        exec($cmd, $o, $ret);
        if ($ret !== 0 || !file_exists($out)) {
            throw new \RuntimeException('ffmpeg failed to transcode');
        }
        $probe = sprintf("ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 %s",
                         escapeshellarg($out));
        $duration = (float)trim(shell_exec($probe) ?: '0');
        $bytes = filesize($out);
        return [$duration, $bytes, basename($out)];
    }
}
