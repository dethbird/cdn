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
    $kind = trim($req->getQueryParams()['kind'] ?? '');
    $sort = trim($req->getQueryParams()['sort'] ?? '');
    $order = strtolower(trim($req->getQueryParams()['order'] ?? ''));
    if ($order !== 'asc' && $order !== 'desc') $order = 'desc';
    $perPage = (int)($req->getQueryParams()['per_page'] ?? 15);
    if ($perPage <= 0) $perPage = 15;
    $allowedPer = [5,15,25,50,100];
    if (!in_array($perPage, $allowedPer, true)) $perPage = 15;
    $page = (int)($req->getQueryParams()['page'] ?? 1);
    if ($page < 1) $page = 1;
    $resArr = $this->fetchItems($project, $q, $kind, $sort, $order, $page, $perPage);
    $items = $resArr['items'];
    $total = $resArr['total'];
    $totalPages = (int) max(1, ceil($total / $perPage));
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
            'kind' => $kind,
            'sort' => $sort,
            'order' => $order,
            'items' => $items,
            'projects' => $projects,
            'flash' => $flash,
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'total_pages' => $totalPages,
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
                    [$w1200,$h1200,$w800,$h800,$w320,$h320,$bytes,$urls] = $this->transcoder->imageToRenditions($tmp, $mediaDir, $id, fn()=> rtrim(($_ENV['BASE_URL'] ?? ''), '/'));
                } catch (\Throwable $e) {
                    // record pending metadata if transcode fails
                    $id = bin2hex(random_bytes(8));
                    $row = [
                        'id'=>$id,'kind'=>'pending','project'=>$project,'project_id'=>($projectId?:null),'title'=>$title,'src_mime'=>$mime,'ext'=>'',
                        'width'=>null,'height'=>null,'duration_sec'=>null,'bytes'=>(int)$file->getSize(),'sha256'=>'','url_main'=>'','url_1200'=>null,'url_800'=>null,'url_320'=>null
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
                    'url_main'=>$urlMain,'url_1200'=>$urls['1200'],'url_800'=>$urls['800'],'url_320'=>$urls['320']
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
                            'width'=>null,'height'=>null,'duration_sec'=>null,'bytes'=>(int)$file->getSize(),'sha256'=>'','url_main'=>'','url_1200'=>null,'url_800'=>null,'url_320'=>null
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
                        'url_main'=>$urlMain,'url_1200'=>null,'url_800'=>null,'url_320'=>null
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
                        'url_320' => null,
                    ];
                    $this->db->insert('media', $row);
                    $info['id'] = $id;
                }
            }
        }
        render_and_return:

        // After upload, render an interstitial preview page showing the uploaded media and metadata.
        // Provide enough fields for the preview template to show an image or audio player.
        $uploadInfo = $info;
        if (!empty($info['id'])) {
            $stmtm = $this->db->pdo()->prepare('SELECT * FROM media WHERE id = :id');
            $stmtm->execute([':id'=>$info['id']]);
            $row = $stmtm->fetch();
            if ($row) {
                // copy relevant fields
                $uploadInfo['id'] = $row['id'];
                $uploadInfo['kind'] = $row['kind'];
                $uploadInfo['url_main'] = $row['url_main'];
                $uploadInfo['url_1200'] = $row['url_1200'];
                $uploadInfo['url_800'] = $row['url_800'];
                $uploadInfo['url_320'] = $row['url_320'];
                $uploadInfo['width'] = $row['width'];
                $uploadInfo['height'] = $row['height'];
                $uploadInfo['duration_sec'] = $row['duration_sec'];
                $uploadInfo['bytes'] = $row['bytes'];
                $uploadInfo['src_mime'] = $row['src_mime'];
                $uploadInfo['ext'] = $row['ext'];
                $uploadInfo['title'] = $row['title'];
                $uploadInfo['project'] = $row['project'];
                $uploadInfo['created_at'] = $row['created_at'];
            }
        }
        return $this->twig->render($res, 'media/preview.twig', [
            'upload_info' => $uploadInfo,
        ]);
    }

    /**
     * Helper to fetch media items and compute human-readable size
     */
    private function fetchItems(string $project = '', string $q = '', string $kind = '', string $sort = '', string $order = 'desc', int $page = 1, int $perPage = 15): array
    {
        // join projects to prefer project name from projects table when available
        $sql = 'SELECT m.id,m.kind,COALESCE(p.name,m.project) AS project,m.title,m.bytes,m.created_at,m.url_main,m.url_1200,m.url_800,m.url_320,m.width,m.height,m.duration_sec FROM media m LEFT JOIN projects p ON m.project_id = p.id';
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
        if ($kind !== '' && $kind !== 'any') {
            $conds[] = '(m.kind = :k)';
            $args[':k'] = $kind;
        }
        if (!empty($conds)) {
            $sql .= ' WHERE ' . implode(' AND ', $conds);
        }
        // Safe mapping for sortable columns
        $allowed = [
            'title' => 'm.title COLLATE NOCASE',
            'size' => 'm.bytes',
            'created' => 'm.created_at',
        ];
        $orderSql = 'm.created_at DESC';
        if ($sort !== '' && isset($allowed[$sort])) {
            $ord = strtolower($order) === 'asc' ? 'ASC' : 'DESC';
            $orderSql = $allowed[$sort] . ' ' . $ord;
        }
        // compute total count
        $countSql = 'SELECT COUNT(*) as c FROM media m LEFT JOIN projects p ON m.project_id = p.id';
        if (!empty($conds)) {
            $countSql .= ' WHERE ' . implode(' AND ', $conds);
        }
        $cstmt = $this->db->pdo()->prepare($countSql);
        $cstmt->execute($args);
        $cntRow = $cstmt->fetch();
        $total = (int)($cntRow['c'] ?? 0);

        // apply limit/offset
        $offset = ($page - 1) * $perPage;
        if ($offset < 0) $offset = 0;
        $sql .= ' ORDER BY ' . $orderSql . ' LIMIT :limit OFFSET :offset';
        $stmt = $this->db->pdo()->prepare($sql);
        // bind args
        foreach ($args as $k=>$v) $stmt->bindValue($k, $v);
    $stmt->bindValue(':limit', $perPage, \PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, \PDO::PARAM_INT);
        $stmt->execute();
        $items = $stmt->fetchAll();
        foreach ($items as &$it) {
            $it['size_human'] = $this->humanBytes((int)($it['bytes'] ?? 0));
        }
        unset($it);
        return ['items'=>$items,'total'=>$total];
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
