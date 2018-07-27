<?php

namespace podmail;

include dirname(__FILE__) . "/init.php";

// Prepare session
$session_factory = new \Aura\Session\SessionFactory;
$session = $session_factory->newInstance($_COOKIE);
$session->setName("podmail");
$session->setCookieParams(['lifetime' => '1209600', 'path' => '/', 'domain' => $config['domain'], 'secure' => true, 'httponly' => true]);
$config['true_session'] = $session;
$segment = $session->getSegment('podmail');
$config['session'] = $segment;
$char_id = (int) $segment->get('char_id');

// Prepare Slim & Twig
$app = new \Slim\App(['settings' => ['displayErrorDetails' => true]]);
$twig = new \Slim\Views\Twig('templates/', ['cache' => false]);
if ($char_id > 0) {
    $twig->getEnvironment()->addGlobal('character_id', $char_id);
    $twig->getEnvironment()->addGlobal('character_name', Info::getInfoField($config['db'], 'character_id', $char_id, 'name'));
    $char = $config['db']->queryDoc('information', ['type' => 'character_id', 'id' => $char_id]);
    if ($char != null) {
        Info::addInfo($config['db'], $char);
        $twig->getEnvironment()->addGlobal('character', $char);
        $twig->getEnvironment()->addGlobal('theme', $config['db']->queryField('users', 'theme', ['character_id' => $char_id]));
    }
}
$app->view = $twig;
addRoute($app, '/', 'index.php', $config, $char_id);
addRoute($app, '/about', 'about.php', $config, $char_id);
addRoute($app, '/action/{type}/{id}/{action}/{value}', 'action.php', $config, $char_id, 'post');
addRoute($app, '/ccp-login', 'ccp-login.php', $config, $char_id);
addRoute($app, '/ccp-callback', 'ccp-callback.php', $config, $char_id);
addRoute($app, '/compose', 'compose.php', $config, $char_id);
addRoute($app, '/compose', 'compose.php', $config, $char_id, 'post');
addRoute($app, '/delta', 'delta.php', $config, $char_id);
addRoute($app, '/folder/{id}[/{page}]', 'folder_id.php', $config, $char_id);
addRoute($app, '/folders', 'folders.php', $config, $char_id);
addRoute($app, '/logout', 'logout.php', $config, $char_id);
addRoute($app, '/mail/{id}', 'mail_id.php', $config, $char_id);
addRoute($app, '/user/{key}/{value}', 'user.php', $config, $char_id);
$app->run();

// Helper function, assigns a path to a view
function addRoute(\Slim\App &$app, string $url, string $file, array $config, int $char_id, string $type = 'get')
{
    $validTypes = ['get', 'post'];
    if (!in_array($type, $validTypes)) throw new \IllegalArguementException("Invalid type: $type");
    $app->$type($url, function (\Psr\Http\Message\ServerRequestInterface $request, \Psr\Http\Message\ResponseInterface $response, array $args) 
            use ($app, $file, $char_id, $config) {
            return (include "view/" . $file)->withHeader('Access-Control-Allow-Origin', "https://" . $config['domain'])->withHeader('Access-Control-Allow-Methods', 'GET, POST')->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization');
            });
}
