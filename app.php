<?php

namespace podmail;

include dirname(__FILE__) . "/init.php";

// Prepare session
$session_factory = new \Aura\Session\SessionFactory;
$session = $session_factory->newInstance($_COOKIE);
$session->setName("podmail");
$session->setCookieParams(['lifetime' => '1209600', 'path' => '/', 'domain' => $config['domain'], 'secure' => true, 'httponly' => true]);
$segment = $session->getSegment('podmail');
$config['session'] = $segment;
$char_id = (int) $segment->get('char_id');

// Prepare Slim & Twig
$app = new \Slim\App(['settings' => ['displayErrorDetails' => true]]);
$twig = new \Slim\Views\Twig('templates/', ['cache' => false]);
$app->view = $twig;
addRoute($app, '/', 'index.php', $config, $char_id);
addRoute($app, '/about', 'about.php', $config, $char_id);
addRoute($app, '/ccp-login', 'ccp-login.php', $config, $char_id);
addRoute($app, '/ccp-callback', 'ccp-callback.php', $config, $char_id);
addRoute($app, '/delta', 'delta.php', $config, $char_id);
addRoute($app, '/logout', 'logout.php', $config, $char_id);
$app->run();

// Helper function, assigns a path to a view
function addRoute(\Slim\App &$app, string $url, string $file, array $config, int $char_id, string $type = 'get')
{
    $validTypes = ['get', 'post'];
    if (!in_array($type, $validTypes)) throw new \IllegalArguementException("Invalid type: $type");
    $app->$type($url, function (\Psr\Http\Message\ServerRequestInterface $request, \Psr\Http\Message\ResponseInterface $response, array $args) 
            use ($app, $file, $char_id, $config) {
                return include "view/" . $file;
            });
}
