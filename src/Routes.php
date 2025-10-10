<?php
declare(strict_types=1);

use Slim\App;
use App\Db;
use App\Transcoder;
use App\Controllers\AdminController;
use App\Controllers\MediaController;

return function (App $app, Db $db, Transcoder $transcoder): void {
    $admin = new AdminController($db);
    $media = new MediaController($db, $transcoder);

    $app->get('/', [$admin, 'index']);
    $app->options('/api/{routes:.+}', fn($req,$res)=>$res);
    $app->post('/api/upload', [$media, 'upload']);
    $app->get('/api/media',  [$media, 'list']);
    $app->delete('/api/media/{id}', [$media, 'delete']);
};
