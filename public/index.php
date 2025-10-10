<?php
declare(strict_types=1);

use Slim\Factory\AppFactory;

require __DIR__ . '/../vendor/autoload.php';

if (file_exists(dirname(__DIR__).'/.env')) {
    $dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__));
    $dotenv->load();
}

// --- Debug helpers: enable errors and log uncaught exceptions/fatals to public/error.log
// This is safe to keep during debugging; you can remove it once the issue is found.
ini_set('display_errors', (string) (filter_var($_ENV['APP_DEBUG'] ?? 'false', FILTER_VALIDATE_BOOL) ? '1' : '0'));
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

set_exception_handler(function (Throwable $e) {
    $msg = sprintf("[%s] Uncaught exception: %s in %s:%d\nStack:\n%s\n\n", date('c'), $e->getMessage(), $e->getFile(), $e->getLine(), $e->getTraceAsString());
    @file_put_contents(__DIR__ . '/error.log', $msg, FILE_APPEND);
    // If debug is enabled, re-throw so Slim's error middleware can show it.
    if (filter_var($_ENV['APP_DEBUG'] ?? false, FILTER_VALIDATE_BOOL)) {
        throw $e;
    }
    // Otherwise, send a minimal 500 response
    if (!headers_sent()) http_response_code(500);
    echo "An internal error occurred. Check public/error.log for details.";
    exit;
});

register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        $msg = sprintf("[%s] Fatal error: %s in %s:%d\n\n", date('c'), $err['message'], $err['file'], $err['line']);
        @file_put_contents(__DIR__ . '/error.log', $msg, FILE_APPEND);
    }
});

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
(require __DIR__ . '/../src/Routes.php')($app, $db, $transcoder);
$app->run();
