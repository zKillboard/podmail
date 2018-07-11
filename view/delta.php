<?php

if ($char_id == 0) return $response;

$redis = $config['redis'];

/*$time = time();
$ttl = ($time - ($time % 60));
$minute = date('i');
if ($redis->set("podmail:cron:$minute", "true", ['nx', ['ex' => $ttl]]) === true) {
//    exec(__DIR__ . "/./cron.sh > /dev/null 2>&1 &");
}*/

$key = "podmail:delta:$char_id";
$delta = $redis->get($key);
$row = unserialize($delta);

$payload = ['delta' => @$row['uniq']];

if (isset($row['notification'])) {
    $payload['notification'] = $row['notification'];
}

$json = json_encode($payload);
return $app->view->render($response->withHeader('Content-type', 'application/json'), 'json.twig', ['json' => $json]);
