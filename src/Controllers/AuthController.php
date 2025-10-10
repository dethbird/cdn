<?php
declare(strict_types=1);

namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Views\Twig;

final class AuthController
{
    public function __construct(private Twig $twig) {}

    public function loginForm(Request $req, Response $res): Response
    {
        return $this->twig->render($res, 'auth/login.twig');
    }

    public function login(Request $req, Response $res): Response
    {
        $data = $req->getParsedBody();
        $password = (string)($data['password'] ?? '');

        $hash = $_ENV['UPLOAD_PASSWORD_HASH'] ?? '';

        if ($hash === '') {
            // not configured
            $res->getBody()->write('Login not configured');
            return $res->withStatus(500);
        }

        if (password_verify($password, $hash)) {
            // mark session
            $_SESSION['user'] = 'admin';
            // redirect to admin
            return $res->withHeader('Location', '/')->withStatus(302);
        }

        // failed
        return $this->twig->render($res, 'auth/login.twig', ['error' => 'Invalid password']);
    }

    public function logout(Request $req, Response $res): Response
    {
        unset($_SESSION['user']);
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params['path'], $params['domain'], $params['secure'], $params['httponly']
            );
        }
        session_destroy();
        return $res->withHeader('Location', '/login')->withStatus(302);
    }
}
