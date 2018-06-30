<?php

namespace podmail;

require_once '../init.php';

$guzzler = Util::getGuzzler($config);
$db = $config['db'];

echo "Fetching labels\n";
$unFetched = $db->query('labels', ['name' => null]);
foreach ($unFetched as $label) {
    $params = ['label_id' => $label['label_id']];
    $row = $db->queryDoc('scopes', ['scope' => 'esi-mail.read_mail.v1', 'character_id' => $label['character_id']]);
        
    SSO::getAccessToken($config, $row['character_id'], $row['refresh_token'], $guzzler, '\podmail\success', '\podmail\fail', $params);
} 
$guzzler->finish();
echo "Done fetching labels\n";

function success(&$guzzler, $params, $content)
{
    $json = json_decode($content, true);
    $access_token = $json['access_token'];
    $label_id = $params['label_id'];

    $params['access_token'] = $access_token;
    $headers = ['Content-Type' => 'application/json', 'Authorization' => "Bearer $access_token"];
    $char_id = $params['char_id'];
    $esi = $params['config']['ccp']['esi'];
    $url = "$esi/v3/characters/$char_id/mail/labels/";
    $guzzler->call($url, '\podmail\mailSuccess', '\podmail\fail', $params, $headers);
}

function mailSuccess(&$guzzler, $params, $content)
{
    $labels = json_decode($content, true);
    foreach ($labels['labels'] as $label) {
        $params['config']['db']->update('labels', ['label_id' => $label['label_id']], ['$set' => ['name' => $label['name']], '$unset' => ['character_id' => 1]]);
    }
}


function fail(&$guzzler, $params, $ex)
{
}
