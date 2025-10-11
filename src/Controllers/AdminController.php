<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Db;
use Slim\Views\Twig;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class AdminController
{
    public function __construct(private Db $db, private Twig $twig, private \App\Transcoder $transcoder) {}

    public function index(Request $req, Response $res): Response
    {
        $project = trim($req->getQueryParams()['project'] ?? '');
        $q = trim($req->getQueryParams()['q'] ?? '');
        $items = $this->fetchItems($project, $q);
        // fetch projects for dropdown
        $stmt = $this->db->pdo()->query('SELECT id,name FROM projects ORDER BY name');
        $projects = $stmt->fetchAll();
        // read and clear flash from session
        $flash = null;
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        if (!empty($_SESSION['flash'])) { $flash = $_SESSION['flash']; unset($_SESSION['flash']); }
        return $this->twig->render($res, 'admin/index.twig', [
            'project' => $project,
            'q' => $q,
            'items' => $items,
            'projects' => $projects,
            'flash' => $flash,
        ]);
    }

    public function uploadSubmit(Request $req, Response $res): Response
    {
        // Read form fields and uploaded file details and persist metadata only
        $body = $req->getParsedBody() ?: [];
        $title = trim($body['title'] ?? '');
        // form submits project id now; resolve to name for compatibility
        $projectId = trim($body['project'] ?? '');
        $project = '';
        if ($projectId !== '') {
            $stmtp = $this->db->pdo()->prepare('SELECT name FROM projects WHERE id = :id');
            $stmtp->execute([':id' => $projectId]);
            $rp = $stmtp->fetch();
            if ($rp && isset($rp['name'])) $project = $rp['name'];
        } else {
            // no project selected: default to the seeded 'Social Media' project if present
            $stmtp = $this->db->pdo()->prepare('SELECT id,name FROM projects WHERE name = :name LIMIT 1');
            $stmtp->execute([':name' => 'Social Media']);
            $rp = $stmtp->fetch();
            if ($rp && isset($rp['id'])) {
                $projectId = $rp['id'];
                $project = $rp['name'];
            }
        }

        $files = $req->getUploadedFiles();
        $file = $files['file'] ?? null;
        $info = [
            'title' => $title,
            'project' => $project,
            'filename' => null,
            'size' => null,
            'media_type' => null,
        ];

        if ($file && $file->getError() === UPLOAD_ERR_OK) {
            $info['filename'] = $file->getClientFilename();
            $info['size'] = $file->getSize();
            $info['media_type'] = $file->getClientMediaType();

            // If image, process immediately (transcode to webp at 1200/800) and persist
            $tmp = $file->getStream()->getMetadata('uri');
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime  = finfo_file($finfo, $tmp) ?: 'application/octet-stream';
            finfo_close($finfo);

            $isImage = in_array($mime, ['image/jpeg','image/png','image/webp','image/gif']);
            if ($isImage) {
                $id = bin2hex(random_bytes(8));
                // store images under public/m/i/<id>/ to separate image and audio namespaces
                $mediaDir = __DIR__ . '/../../public/m/i/' . $id;
                if (!is_dir($mediaDir)) mkdir($mediaDir, 0775, true);
                try {
                    [$w1200,$h1200,$w800,$h800,$bytes,$urls] = $this->transcoder->imageToRenditions($tmp, $mediaDir, $id, fn()=> rtrim(($_ENV['BASE_URL'] ?? ''), '/'));
                } catch (\Throwable $e) {
                    // record pending metadata if transcode fails
                    $id = bin2hex(random_bytes(8));
                    $row = [
                        'id'=>$id,'kind'=>'pending','project'=>$project,'project_id'=>($projectId?:null),'title'=>$title,'src_mime'=>$mime,'ext'=>'',
                        'width'=>null,'height'=>null,'duration_sec'=>null,'bytes'=>(int)$file->getSize(),'sha256'=>'','url_main'=>'','url_1200'=>null,'url_800'=>null
                    ];
                    $this->db->insert('media', $row);
                    $info['id'] = $id;
                    goto render_and_return;
                }
                $urlMain = $urls['1200'];
                $row = [
                    'id'=>$id,'kind'=>'image','project'=>$project,'project_id'=>($projectId?:null),'title'=>$title,'src_mime'=>$mime,'ext'=>'webp',
                    'width'=>$w1200,'height'=>$h1200,'duration_sec'=>null,'bytes'=>$bytes,
                    'sha256'=>hash_file('sha256', $mediaDir . "/{$id}-1200.webp"),
                    'url_main'=>$urlMain,'url_1200'=>$urls['1200'],'url_800'=>$urls['800']
                ];
                $this->db->insert('media', $row);
                $info['id'] = $id;
            } else {
                // non-image: check audio whitelist and transcode to mp3 when possible,
                // otherwise persist as pending metadata for later processing
                $tmp = $file->getStream()->getMetadata('uri');
                $finfo = finfo_open(FILEINFO_MIME_TYPE);
                $mime  = finfo_file($finfo, $tmp) ?: 'application/octet-stream';
                finfo_close($finfo);

                $isAudio = in_array($mime, ['audio/mpeg','audio/wav','audio/x-wav','audio/flac','audio/ogg','audio/aac']);
                if ($isAudio) {
                    $id = bin2hex(random_bytes(8));
                    // store audio under public/m/a/<id>/ namespace
                    $mediaDir = __DIR__ . '/../../public/m/a/' . $id;
                    if (!is_dir($mediaDir)) mkdir($mediaDir, 0775, true);
                    try {
                        [$duration,$bytes,$filename] = $this->transcoder->audioToMp3($tmp, $mediaDir, $id);
                    } catch (\Throwable $e) {
                        // record pending metadata if transcode fails
                        $id = bin2hex(random_bytes(8));
                        $row = [
                            'id'=>$id,'kind'=>'pending','project'=>$project,'project_id'=>($projectId?:null),'title'=>$title,'src_mime'=>$mime,'ext'=>'',
                            'width'=>null,'height'=>null,'duration_sec'=>null,'bytes'=>(int)$file->getSize(),'sha256'=>'','url_main'=>'','url_1200'=>null,'url_800'=>null
                        ];
                        $this->db->insert('media', $row);
                        $info['id'] = $id;
                        goto render_and_return;
                    }
                    $base = rtrim(($_ENV['BASE_URL'] ?? ''), '/');
                    $urlMain = $base . "/m/a/{$id}/{$filename}";
                    $row = [
                        'id'=>$id,'kind'=>'audio','project'=>$project,'project_id'=>($projectId?:null),'title'=>$title,'src_mime'=>$mime,'ext'=>'mp3',
                        'width'=>null,'height'=>null,'duration_sec'=>$duration,'bytes'=>$bytes,
                        'sha256'=>hash_file('sha256', $mediaDir . "/{$filename}"),
                        'url_main'=>$urlMain,'url_1200'=>null,'url_800'=>null
                    ];
                    $this->db->insert('media', $row);
                    $info['id'] = $id;
                } else {
                    $id = bin2hex(random_bytes(8));
                    $ext = pathinfo($file->getClientFilename() ?? '', PATHINFO_EXTENSION) ?: '';
                    $row = [
                        'id' => $id,
                        'kind' => 'pending',
                        'project' => $project,
                        'project_id' => ($projectId ?: null),
                        'title' => $title,
                        'src_mime' => $file->getClientMediaType() ?: 'application/octet-stream',
                        'ext' => $ext,
                        'width' => null,
                        'height' => null,
                        'duration_sec' => null,
                        'bytes' => (int)($file->getSize() ?? 0),
                        'sha256' => '',
                        'url_main' => '',
                        'url_1200' => null,
                        'url_800' => null,
                    ];
                    $this->db->insert('media', $row);
                    $info['id'] = $id;
                }
            }
        }
        render_and_return:

        // Render the admin index with a success message and the current media list
        $items = $this->fetchItems('', '');
        // fetch projects for dropdown
        $stmt = $this->db->pdo()->query('SELECT id,name FROM projects ORDER BY name');
        $projects = $stmt->fetchAll();
        return $this->twig->render($res, 'admin/index.twig', [
            'project' => '',
            'q' => '',
            'items' => $items,
            'projects' => $projects,
            'upload_info' => $info,
        ]);
    }

    /**
     * Helper to fetch media items and compute human-readable size
     */
    private function fetchItems(string $project = '', string $q = ''): array
    {
        // join projects to prefer project name from projects table when available
        $sql = 'SELECT m.id,m.kind,COALESCE(p.name,m.project) AS project,m.title,m.bytes,m.created_at,m.url_main,m.url_1200,m.url_800,m.width,m.height,m.duration_sec FROM media m LEFT JOIN projects p ON m.project_id = p.id';
        $args = [];
        $conds = [];
        if ($project !== '') {
            // allow filtering by project id or name; media.project sometimes stores a name for
            // backwards-compatibility, and media.project_id stores the FK id.
            $conds[] = '(m.project_id = :p OR m.project = :p OR p.id = :p OR p.name = :p)';
            $args[':p'] = $project;
        }
        if ($q !== '') {
            // case-insensitive title search (SQLite COLLATE NOCASE)
            $conds[] = '(m.title LIKE :q COLLATE NOCASE)';
            $args[':q'] = '%' . $q . '%';
        }
        if (!empty($conds)) {
            $sql .= ' WHERE ' . implode(' AND ', $conds);
        }
        $sql .= ' ORDER BY m.created_at DESC LIMIT 200';
        $stmt = $this->db->pdo()->prepare($sql);
        $stmt->execute($args);
        $items = $stmt->fetchAll();
        foreach ($items as &$it) {
            $it['size_human'] = $this->humanBytes((int)($it['bytes'] ?? 0));
        }
        unset($it);
        return $items;
    }

    public function uploadForm(Request $req, Response $res): Response
    {
        // fetch projects for dropdown
        $stmt = $this->db->pdo()->query('SELECT id,name FROM projects ORDER BY name');
        $projects = $stmt->fetchAll();
        return $this->twig->render($res, 'media/upload.twig', [
            'projects' => $projects,
        ]);
    }

    public function editForm(Request $req, Response $res, array $args): Response
    {
        $id = $args['id'] ?? '';
        if ($id === '') {
            $res = new \Slim\Psr7\Response();
            return $res->withStatus(400);
        }
        $stmt = $this->db->pdo()->prepare('SELECT * FROM media WHERE id = :id');
        $stmt->execute([':id'=>$id]);
        $row = $stmt->fetch();
        if (!$row) {
            $res = new \Slim\Psr7\Response();
            return $res->withStatus(404);
        }
        // fetch projects
        $stmtp = $this->db->pdo()->query('SELECT id,name FROM projects ORDER BY name');
        $projects = $stmtp->fetchAll();
        return $this->twig->render($res, 'media/edit.twig', [
            'media' => $row,
            'projects' => $projects,
        ]);
    }

    public function editSubmit(Request $req, Response $res, array $args): Response
    {
        $id = $args['id'] ?? '';
        if ($id === '') {
            $res = new \Slim\Psr7\Response();
            return $res->withStatus(400);
        }
        // fetch existing row
        $stmt = $this->db->pdo()->prepare('SELECT * FROM media WHERE id = :id');
        $stmt->execute([':id'=>$id]);
        $row = $stmt->fetch();
        if (!$row) {
            $res = new \Slim\Psr7\Response();
            return $res->withStatus(404);
        }

        $body = $req->getParsedBody() ?: [];
        $title = trim($body['title'] ?? $row['title'] ?? '');
        $projectId = trim($body['project'] ?? ($row['project_id'] ?? ''));
        $project = $row['project'] ?? '';
        if ($projectId !== '') {
            $stmtp = $this->db->pdo()->prepare('SELECT name FROM projects WHERE id = :id');
            $stmtp->execute([':id' => $projectId]);
            $rp = $stmtp->fetch();
            if ($rp && isset($rp['name'])) $project = $rp['name'];
        }

        // Only update metadata (title/project). Files cannot be replaced from edit.
        $this->db->pdo()->prepare('UPDATE media SET title = :t, project = :proj, project_id = :pid WHERE id = :id')
            ->execute([':t'=>$title, ':proj'=>$project, ':pid'=>($projectId?:null), ':id'=>$id]);
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        $_SESSION['flash'] = ['type'=>'success','message'=>"Saved media {$id}"];
        $res = new \Slim\Psr7\Response();
        return $res->withHeader('Location', '/')->withStatus(302);
    }

    private function humanBytes(int $b): string {
        $u=['B','KB','MB','GB']; $i=0;
        while($b>=1024 && $i<count($u)-1){$b/=1024;$i++;}
        return (string) round($b,1) . ' ' . $u[$i];
    }
}
