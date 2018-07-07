<?php

namespace podmail;

require_once '../init.php';

$guzzler = Util::getGuzzler($config, 1);
$db = $config['db'];

$db->update('scopes', ['scope' => 'esi-mail.read_mail.v1', 'lastLabelUpdate' => ['$exists' => false]], ['$set' => ['lastLabelUpdate' => 0]], ['multi' => true]);

$minute = date('Hi');
while ($minute == date('Hi')) {
    $row = $db->queryDoc('scopes', ['scope' => 'esi-mail.read_mail.v1', 'lastLabelUpdate' => ['$lt' => (time() - 3600)]]);
    if ($row != null) {
        $params = ['row' => $row];
        SSO::getAccessToken($config, $row['character_id'], $row['refresh_token'], $guzzler, '\podmail\success', '\podmail\SSO::fail', $params);
        $guzzler->finish();
    } else sleep(1);
}
$guzzler->finish();

function success(&$guzzler, $params, $content)
{
    $json = json_decode($content, true);
    $access_token = $json['access_token'];

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
    $labels = $labels['labels'];

    $labels[] = ['label_id' => 0, 'name' => 'All Mails'];
    $labels[] = ['label_id' => 999999998, 'name' => 'No Label'];
    $labels[] = ['label_id' => 999999999, 'name' => 'Notifications'];

    $l = [];
    foreach ($labels as $label) {
        unset($label['color']);
        unset($label['unread_count']);
        $l[$label['label_id']] = $label;
    }
    ksort($l);
    $char_id = $params['char_id'];
    $db->update('scopes', ['scope' => 'esi-mail.read_mail.v1', 'character_id' => $char_id], ['$set' => ['labels' => $l, 'lastLabelUpdate' => time()]]);
    Util::setDelta($db, $char_id);
}
