<?php
declare(strict_types=1);

use Slim\App;
use App\Db;
use App\Transcoder;
use App\Controllers\AdminController;
use App\Controllers\MediaController;
use App\Controllers\AuthController;
use App\Controllers\ProjectsController;

return function (App $app, Db $db, Transcoder $transcoder, \Slim\Views\Twig $twig): void {
    $admin = new AdminController($db, $twig, $transcoder);
    $media = new MediaController($db, $transcoder);
    $auth = new AuthController($twig);
    $projects = new ProjectsController($db, $twig);

    // simple auth middleware
    $requireAuth = function ($request, $handler) {
        if (empty($_SESSION['user'])) {
            $res = new \Slim\Psr7\Response();
            return $res->withHeader('Location', '/login')->withStatus(302);
        }
        return $handler->handle($request);
    };

    $app->get('/', [$admin, 'index'])->add($requireAuth);
    $app->get('/upload', [$admin, 'uploadForm'])->add($requireAuth);
    $app->post('/upload', [$admin, 'uploadSubmit'])->add($requireAuth);
    $app->get('/login', [$auth, 'loginForm']);
    $app->post('/login', [$auth, 'login']);
    $app->get('/logout', [$auth, 'logout']);
    $app->options('/api/{routes:.+}', fn($req,$res)=>$res);
    $app->post('/api/upload', [$media, 'upload']);
    $app->get('/api/media',  [$media, 'list']);
    $app->delete('/api/media/{id}', [$media, 'delete']);
    // admin media delete (session-protected)
    $app->post('/media/{id}/delete', [$media, 'deleteAdmin'])->add($requireAuth);

    // Projects management
    $app->get('/projects', [$projects, 'list'])->add($requireAuth);
    $app->get('/projects/create', [$projects, 'createForm'])->add($requireAuth);
    $app->post('/projects/create', [$projects, 'create'])->add($requireAuth);
    $app->get('/projects/{id}/rename', [$projects, 'renameForm'])->add($requireAuth);
    $app->post('/projects/{id}/rename', [$projects, 'rename'])->add($requireAuth);
    $app->post('/projects/{id}/delete', [$projects, 'delete'])->add($requireAuth);
};
