<?php

if ($char_id == 0) return $response;

$redis = $config['redis'];

$key = "podmail:delta:$char_id";
$ret = $redis->multi()->get($key)->del($key)->exec();
$row = unserialize($ret[0]);

$payload = ['delta' => @$row['uniq']];

if (isset($row['notification'])) {
    $payload['notification'] = $row['notification'];
}

$json = json_encode($payload);
return $app->view->render($response->withHeader('Content-type', 'application/json'), 'json.twig', ['json' => $json]);
