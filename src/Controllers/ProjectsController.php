<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Db;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Views\Twig;

final class ProjectsController
{
    public function __construct(private Db $db, private Twig $twig) {}

    public function list(Request $req, Response $res): Response
    {
        $stmt = $this->db->pdo()->query('SELECT id,name,created_at FROM projects ORDER BY name');
        $projects = $stmt->fetchAll();
        return $this->twig->render($res, 'projects/list.twig', ['projects'=>$projects]);
    }

    public function createForm(Request $req, Response $res): Response
    {
        return $this->twig->render($res, 'projects/create.twig');
    }

    public function create(Request $req, Response $res): Response
    {
        $data = $req->getParsedBody();
        $name = trim($data['name'] ?? '');
        if ($name === '') {
            return $this->twig->render($res, 'projects/create.twig', ['error'=>'Name required']);
        }
        $id = bin2hex(random_bytes(8));
        $this->db->insert('projects', ['id'=>$id,'name'=>$name]);
        return $res->withHeader('Location', '/projects')->withStatus(302);
    }

    public function renameForm(Request $req, Response $res, array $args): Response
    {
        $id = $args['id'] ?? '';
        if ($id === '') return $res->withStatus(404);
        $stmt = $this->db->pdo()->prepare('SELECT id,name FROM projects WHERE id=:id');
        $stmt->execute([':id'=>$id]);
        $p = $stmt->fetch();
        if (!$p) return $res->withStatus(404);
        return $this->twig->render($res, 'projects/rename.twig', ['project'=>$p]);
    }

    public function rename(Request $req, Response $res, array $args): Response
    {
        $id = $args['id'] ?? '';
        $data = $req->getParsedBody();
        $name = trim($data['name'] ?? '');
        if ($id === '' || $name === '') return $res->withStatus(400);
        $this->db->pdo()->prepare('UPDATE projects SET name=:name WHERE id=:id')->execute([':name'=>$name, ':id'=>$id]);
        return $res->withHeader('Location', '/projects')->withStatus(302);
    }

    public function delete(Request $req, Response $res, array $args): Response
    {
        $id = $args['id'] ?? '';
        if ($id === '') return $res->withStatus(400);
        // unlink media.project_id first (set to null)
        $this->db->pdo()->prepare('UPDATE media SET project_id = NULL WHERE project_id = :id')->execute([':id'=>$id]);
        $this->db->pdo()->prepare('DELETE FROM projects WHERE id = :id')->execute([':id'=>$id]);
        return $res->withHeader('Location', '/projects')->withStatus(302);
    }
}
