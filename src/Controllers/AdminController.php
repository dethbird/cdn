<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Db;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class AdminController
{
    public function __construct(private Db $db) {}

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

        $html = '<!doctype html><meta charset="utf-8">'.
        '<title>Personal CDN</title>'.
        '<style>body{font:14px/1.4 system-ui,sans-serif;margin:20px;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #ddd;padding:6px;} .url{font-family:ui-monospace,monospace;font-size:12px} .btn{padding:4px 8px;border:1px solid #ccc;border-radius:6px;background:#f7f7f7;cursor:pointer} .kind{font-weight:600} .toolbar{display:flex;gap:8px;margin-bottom:12px}</style>';
        $html .= '<h1>Personal CDN</h1>';
        $html .= '<div class="toolbar"><form method="get"><input name="project" placeholder="filter by project" value="'.htmlspecialchars($project).'"><button class="btn">Filter</button></form></div>';
        $html .= '<table><thead><tr><th>Kind</th><th>Project</th><th>Title</th><th>Size</th><th>Created</th><th>URL</th><th>Copy</th></tr></thead><tbody>';
        foreach ($items as $it) {
            $url = htmlspecialchars($it['url_main']);
            $size = $this->humanBytes((int)$it['bytes']);
            $html .= '<tr>'.
                '<td class="kind">'.htmlspecialchars($it['kind']).'</td>'.
                '<td>'.htmlspecialchars($it['project'] ?? '').'</td>'.
                '<td>'.htmlspecialchars($it['title'] ?? '').'</td>'.
                '<td>'.$size.'</td>'.
                '<td>'.htmlspecialchars($it['created_at']).'</td>'.
                '<td class="url"><a href="'.$url.'" target="_blank">'.$url.'</a></td>'.
                '<td><button class="btn" onclick="copyUrl(\''.$url.'\')">Copy URL</button></td>'.
                '</tr>';
        }
        $html .= '</tbody></table>';
        $html .= '<script>function copyUrl(u){navigator.clipboard.writeText(u).then(()=>alert("Copied!")).catch(()=>{prompt("Copy URL:",u);});}</script>';
        $res->getBody()->write($html);
        return $res;
    }

    private function humanBytes(int $b): string {
        $u=['B','KB','MB','GB']; $i=0;
        while($b>=1024 && $i<count($u)-1){$b/=1024;$i++;}
        return (string) round($b,1) . ' ' . $u[$i];
    }
}
