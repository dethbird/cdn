<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Db;
use Slim\Views\Twig;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class AdminController
{
    public function __construct(private Db $db, private Twig $twig) {}

    public function index(Request $req, Response $res): Response
    {
        $project = trim($req->getQueryParams()['project'] ?? '');
        $items = $this->fetchItems($project);
        return $this->twig->render($res, 'admin/index.twig', [
            'project' => $project,
            'items' => $items,
        ]);
    }

    public function uploadSubmit(Request $req, Response $res): Response
    {
        // Read form fields and uploaded file details but do NOT persist anything
        $body = $req->getParsedBody() ?: [];
        $title = trim($body['title'] ?? '');
        $project = trim($body['project'] ?? '');

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
        }

        // Render the admin index with a success message and the current media list
        $items = $this->fetchItems('');
        return $this->twig->render($res, 'admin/index.twig', [
            'project' => '',
            'items' => $items,
            'upload_info' => $info,
        ]);
    }

    /**
     * Helper to fetch media items and compute human-readable size
     */
    private function fetchItems(string $project = ''): array
    {
        $sql = 'SELECT id,kind,project,title,bytes,created_at,url_main,duration_sec FROM media';
        $args = [];
        if ($project !== '') {
            $sql .= ' WHERE project = :p';
            $args[':p'] = $project;
        }
        $sql .= ' ORDER BY created_at DESC LIMIT 200';
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

    private function humanBytes(int $b): string {
        $u=['B','KB','MB','GB']; $i=0;
        while($b>=1024 && $i<count($u)-1){$b/=1024;$i++;}
        return (string) round($b,1) . ' ' . $u[$i];
    }
}
