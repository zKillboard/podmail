<?php

if ($char_id == 0) return $response;

$db = $config['db'];
$row = $db->queryDoc('scopes', ['scope' => 'esi-mail.read_mail.v1', 'character_id' => $char_id]);

if ($row == null) return  $app->view->render($response->withHeader('Content-type', 'application/json'), 'json.twig', ['json' => json_encode(['logout' => true])]);

$redis = $config['redis'];
$redis->setex("podmail:last_seen:$char_id", 604800, time());

$delta = $redis->get("podmail:delta:$char_id");
$row = unserialize($delta);

$payload = ['delta' => @$row['uniq']];
if (isset($row['notification'])) {
    $payload['notification'] = $row['notification'];
}

$json = json_encode($payload);
return $app->view->render($response->withHeader('Content-type', 'application/json'), 'json.twig', ['json' => $json]);
