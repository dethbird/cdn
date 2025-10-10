<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Db;
use App\Transcoder;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class MediaController
{
    public function __construct(private Db $db, private Transcoder $transcoder) {}

    private function baseUrl(Request $req): string
    {
        $configured = $_ENV['BASE_URL'] ?? '';
        if ($configured) return rtrim($configured, '/');
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $req->getHeaderLine('Host') ?: ($_SERVER['HTTP_HOST'] ?? 'localhost');
        $script = $req->getServerParams()['SCRIPT_NAME'] ?? '';
        $base = rtrim(str_ireplace('index.php', '', $script), '/');
        return $scheme . '://' . $host . $base;
    }

    private function json(Response $res, $data, int $status = 200): Response
    {
        $res->getBody()->write(json_encode($data, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE));
        return $res->withHeader('Content-Type', 'application/json')->withStatus($status);
    }

    private function requireToken(Request $req): void
    {
        $auth = $req->getHeaderLine('Authorization');
        $ok = preg_match('/Bearer\s+(.+)/', $auth, $m) && $m[1] === ($_ENV['UPLOAD_TOKEN'] ?? '');
        if (!$ok) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode(['error'=>'unauthorized']);
            exit;
        }
    }

    public function upload(Request $req, Response $res): Response
    {
        $this->requireToken($req);

        $body = $req->getParsedBody() ?: [];
        $project = trim($body['project'] ?? '');
        $title = trim($body['title'] ?? '');

        $files = $req->getUploadedFiles();
        if (empty($files['file'])) return $this->json($res, ['error'=>'no_file'], 400);
        $file = $files['file'];
        if ($file->getError() !== UPLOAD_ERR_OK) return $this->json($res, ['error'=>'upload_error'], 400);

        $tmp = $file->getStream()->getMetadata('uri');
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime  = finfo_file($finfo, $tmp) ?: 'application/octet-stream';
        finfo_close($finfo);

        $isImage = in_array($mime, ['image/jpeg','image/png','image/webp','image/gif']);
        $isAudio = in_array($mime, ['audio/mpeg','audio/wav','audio/x-wav','audio/flac','audio/ogg','audio/aac']);
        if (!$isImage && !$isAudio) return $this->json($res, ['error'=>'unsupported_mime','mime'=>$mime], 415);

        $id = bin2hex(random_bytes(8));
        $mediaDir = __DIR__ . '/../../public/m/' . $id;
        if (!is_dir($mediaDir)) mkdir($mediaDir, 0775, true);

        $row = [];
        $baseUrl = fn()=> $this->baseUrl($req);

        if ($isImage) {
            try {
                [$w1200,$h1200,$w800,$h800,$bytes,$urls] = $this->transcoder->imageToRenditions($tmp, $mediaDir, $id, $baseUrl);
            } catch (\Throwable $e) {
                return $this->json($res, ['error'=>'image_transcode_failed','message'=>$e->getMessage()], 500);
            }
            $urlMain = $urls['1200'];
            $row = [
                'id'=>$id,'kind'=>'image','project'=>$project,'title'=>$title,'src_mime'=>$mime,'ext'=>'jpg',
                'width'=>$w1200,'height'=>$h1200,'duration_sec'=>null,'bytes'=>$bytes,
                'sha256'=>hash_file('sha256', $mediaDir . "/{$id}-1200.jpg"),
                'url_main'=>$urlMain,'url_1200'=>$urls['1200'],'url_800'=>$urls['800']
            ];
            $payload = [
                'id'=>$id,'kind'=>'image','project'=>$project,'title'=>$title,
                'url'=>$urlMain,'image_1200'=>$urls['1200'],'image_800'=>$urls['800']
            ];
        } else {
            try {
                [$duration,$bytes,$filename] = $this->transcoder->audioToMp3($tmp, $mediaDir, $id);
            } catch (\Throwable $e) {
                return $this->json($res, ['error'=>'audio_transcode_failed','message'=>$e->getMessage()], 500);
            }
            $urlMain = rtrim($baseUrl(),'/')."/m/$id/$filename";
            $row = [
                'id'=>$id,'kind'=>'audio','project'=>$project,'title'=>$title,'src_mime'=>$mime,'ext'=>'mp3',
                'width'=>null,'height'=>null,'duration_sec'=>$duration,'bytes'=>$bytes,
                'sha256'=>hash_file('sha256', $mediaDir . "/$filename"),
                'url_main'=>$urlMain,'url_1200'=>null,'url_800'=>null
            ];
            $payload = [
                'id'=>$id,'kind'=>'audio','project'=>$project,'title'=>$title,
                'url'=>$urlMain,'duration_sec'=>$duration
            ];
        }

        $this->db->insert('media', $row);
        return $this->json($res, $payload, 201);
    }

    public function list(Request $req, Response $res): Response
    {
        $project = trim($req->getQueryParams()['project'] ?? '');
        $sql = 'SELECT id,kind,project,title,bytes,created_at,url_main,url_1200,url_800,duration_sec FROM media';
        $args = [];
        if ($project !== '') {
            $sql .= ' WHERE project = :p';
            $args[':p'] = $project;
        }
        $sql .= ' ORDER BY created_at DESC LIMIT 200';
        $stmt = $this->db->pdo()->prepare($sql);
        $stmt->execute($args);
        return $this->json($res, ['items'=>$stmt->fetchAll()]);
    }

    public function delete(Request $req, Response $res, array $args): Response
    {
        $this->requireToken($req);
        $id = $args['id'] ?? '';
        if ($id === '') return $this->json($res, ['error'=>'bad_id'], 400);

        $stmt = $this->db->pdo()->prepare('SELECT * FROM media WHERE id = :id');
        $stmt->execute([':id'=>$id]);
        $row = $stmt->fetch();
        if (!$row) return $this->json($res, ['ok'=>true]);

        $dir = __DIR__ . '/../../public/m/' . $id;
        if (is_dir($dir)) {
            foreach (glob($dir.'/*') as $f) @unlink($f);
            @rmdir($dir);
        }
        $this->db->pdo()->prepare('DELETE FROM media WHERE id = :id')->execute([':id'=>$id]);
        return $this->json($res, ['ok'=>true]);
    }
}
