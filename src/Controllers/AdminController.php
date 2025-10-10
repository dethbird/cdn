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
        $stmt = $this->db->pdo()->prepare(
            'SELECT id,kind,project,title,bytes,created_at,url_main,duration_sec FROM media ' .
            ($project !== '' ? 'WHERE project = :p ' : '') .
            'ORDER BY created_at DESC LIMIT 200'
        );
        $stmt->execute($project !== '' ? [':p'=>$project] : []);
            $items = $stmt->fetchAll();

            // Precompute human-readable size to keep Twig simple
            foreach ($items as &$it) {
                $it['size_human'] = $this->humanBytes((int)($it['bytes'] ?? 0));
            }
            unset($it);

        // Render via Twig template
            return $this->twig->render($res, 'admin/index.twig', [
                'project' => $project,
                'items' => $items,
        ]);
    }

    private function humanBytes(int $b): string {
        $u=['B','KB','MB','GB']; $i=0;
        while($b>=1024 && $i<count($u)-1){$b/=1024;$i++;}
        return (string) round($b,1) . ' ' . $u[$i];
    }
}
