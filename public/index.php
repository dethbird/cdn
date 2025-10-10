<?php
declare(strict_types=1);

use Slim\Factory\AppFactory;
use Slim\Views\Twig;
use Slim\Views\TwigMiddleware;

require __DIR__ . '/../vendor/autoload.php';

// Start session early so middleware and templates can use it
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (file_exists(dirname(__DIR__).'/.env')) {
    $dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__));
    $dotenv->load();
}

$app = AppFactory::create();
$basePath = rtrim(str_ireplace('index.php', '', $_SERVER['SCRIPT_NAME'] ?? ''), '/');
if (!empty($basePath)) $app->setBasePath($basePath);

$app->addBodyParsingMiddleware();
$app->addRoutingMiddleware();
$app->addErrorMiddleware(filter_var($_ENV['APP_DEBUG'] ?? false, FILTER_VALIDATE_BOOL), true, true);

$app->add(function ($req, $handler) {
    $res = $handler->handle($req);
    $origin = $_ENV['CORS_ALLOW_ORIGIN'] ?? '*';
    return $res
        ->withHeader('Access-Control-Allow-Origin', $origin)
        ->withHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type')
        ->withHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
});

$db = new App\Db($_ENV['DB_PATH'] ?? __DIR__.'/../var/cdn.sqlite');
$transcoder = new App\Transcoder();

// Setup Twig
$twig = Twig::create(__DIR__ . '/../templates', ['cache' => false]);
$app->add(TwigMiddleware::create($app, $twig));

// Expose simple auth state to Twig templates
try {
    $env = $twig->getEnvironment();
    $env->addGlobal('auth', ['logged_in' => !empty($_SESSION['user'])]);
} catch (Throwable $e) {
    // ignore if environment not available
}

(require __DIR__ . '/../src/Routes.php')($app, $db, $transcoder, $twig);
$app->run();
