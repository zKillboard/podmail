<?php

namespace podmail;

require_once '../init.php';

$guzzler = Util::getGuzzler($config, 1);
$db = $config['db'];

if (!$db->exists('information', ['type' => 'label_id', 'id' => 0])) {
    $db->insert('information', ['type' => 'label_id', 'id' => 0, 'name' => 'All Mails']);
    $db->update('delta', [], ['$set' => ['delta' => 1, 'uniq' => uniqid("", true)]], ['multi' => true]);
}

$minute = date('Hi');
while ($minute == date('Hi')) {
    $unFetched = $db->query('information', ['type' => 'label_id', 'update' => true]);
    foreach ($unFetched as $label) {
        $params = ['label_id' => $label['id']];
        $row = $db->queryDoc('scopes', ['scope' => 'esi-mail.read_mail.v1', 'character_id' => $label['character_id']]);

        SSO::getAccessToken($config, $row['character_id'], $row['refresh_token'], $guzzler, '\podmail\success', '\podmail\SSO::fail', $params);
        break;
    } 
    if (sizeof($unFetched) == 0) {
        $guzzler->tick();
        sleep(1);
    }
}
$guzzler->finish();

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
    $guzzler->call($url, '\podmail\mailSuccess', '\podmail\ESI::fail', $params, $headers);
}

function mailSuccess(&$guzzler, $params, $content)
{
    $db = $params['config']['db'];
    $labels = json_decode($content, true);
    foreach ($labels['labels'] as $label) {
        $label_id = $label['label_id'];
        $name = $label['name'];
        echo "Label $label_id => $name\n";
        $db->update('information', ['type' => 'label_id', 'id' => $label_id], ['$set' => ['name' => $name], '$unset' => ['character_id' => 1, 'update' => 1]]);
    }
}
