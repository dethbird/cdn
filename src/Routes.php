<?php
declare(strict_types=1);

use Slim\App;
use App\Db;
use App\Transcoder;
use App\Controllers\AdminController;
use App\Controllers\MediaController;
use App\Controllers\AuthController;

return function (App $app, Db $db, Transcoder $transcoder, \Slim\Views\Twig $twig): void {
    $admin = new AdminController($db, $twig);
    $media = new MediaController($db, $transcoder);
    $auth = new AuthController($twig);

    // simple auth middleware
    $requireAuth = function ($request, $handler) {
        if (empty($_SESSION['user'])) {
            $res = new \Slim\Psr7\Response();
            return $res->withHeader('Location', '/login')->withStatus(302);
        }
        return $handler->handle($request);
    };

    $app->get('/', [$admin, 'index'])->add($requireAuth);
    $app->get('/login', [$auth, 'loginForm']);
    $app->post('/login', [$auth, 'login']);
    $app->get('/logout', [$auth, 'logout']);
    $app->options('/api/{routes:.+}', fn($req,$res)=>$res);
    $app->post('/api/upload', [$media, 'upload']);
    $app->get('/api/media',  [$media, 'list']);
    $app->delete('/api/media/{id}', [$media, 'delete']);
};
