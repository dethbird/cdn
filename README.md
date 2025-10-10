# Personal CDN for Fountain Writer

Slim 4 + PHP 8 + SQLite + ffmpeg + ImageMagick. Upload images/audio, transcode, and serve via Apache with long caching.

## Install
```bash
composer install
cp .env.example .env
# edit UPLOAD_TOKEN and paths
composer start
# http://localhost:8080/
```
Ensure Apache points `DocumentRoot` to `public/` and has mod_rewrite+expires+headers enabled.

## Upload
```bash
curl -X POST http://host/api/upload   -H "Authorization: Bearer $UPLOAD_TOKEN"   -F "project=Demo" -F "title=Rooftop"   -F "file=@/path/to/image-or-audio"
```
