<?php

namespace podmail;

require_once '../init.php';

if (time() % 600 !== 0) exit();

$guzzler = Util::getGuzzler($config);
$db = $config['db'];

if (!$db->exists('information', ['type' => 'label_id', 'id' => 999])) {
    $db->insert('information', ['type' => 'label_id', 'id' => 999, 'name' => 'Notifications']);
}

$minute = date('Hi');
while ($minute == date('Hi')) {
    $db->update('scopes', ['scope' => 'esi-characters.read_notifications.v1', 'lastChecked' => ['$exists' => false]], ['$set' => ['lastChecked' => 0]]);
    $scopes = $db->query('scopes', ['scope' => 'esi-characters.read_notifications.v1'], ['lastChecked' => ['$lte' => (time() - 900)]]);
    foreach ($scopes as $row) {
        $config['row'] = $row;
        echo "Fetching notifications for " . $row['character_id'] . "\n";
        SSO::getAccessToken($config, $row['character_id'], $row['refresh_token'], $guzzler, '\podmail\success', '\podmail\fail');
        $db->update('scopes', $row, ['$set' => ['lastChecked' => time()]]); 
    }
    if (sizeof($scopes) == 0) {
        $guzzler->tick();
        sleep(1);
    }
    break;
}
$guzzler->finish();

function success(&$guzzler, $params, $content)
{
    $json = json_decode($content, true);
    $access_token = $json['access_token'];
    $row = $params['config']['row'];
    $params['config']['db']->update('scopes', $row, ['$set' => ['lastChecked' => time()]]);

    doNextCall($params, $access_token, $guzzler);
}

function doNextCall($params, $access_token, &$guzzler)
{
    $params['access_token'] = $access_token;
    $headers = ['Content-Type' => 'application/json', 'Authorization' => "Bearer $access_token"];
    $char_id = $params['char_id'];
    $esi = $params['config']['ccp']['esi'];
    $url = "$esi/v2/characters/$char_id/notifications/";
    if (isset($params['last_mail_id'])) $url .= "?last_mail_id=" . $params['last_mail_id'];
    $guzzler->call($url, '\podmail\mailSuccess', '\podmail\fail', $params, $headers);
}

function mailSuccess(&$guzzler, $params, $content)
{
    $set_delta = false;
    $db = $params['config']['db'];
    $json = json_decode($content, true);
    $char_id = $params['char_id'];
    foreach ($json as $notif) {
        $notif_mail = ['mail_id' => $notif['notification_id'], 'owner' => $char_id];
        if (!$db->exists('mails', $notif_mail)) {
            if ($notif['sender_type'] == 'character') Info::addChar($db, $notif['sender_id']);
            if ($notif['sender_type'] == 'corporation') Info::addCorp($db, $notif['sender_id']);
            if ($notif['sender_type'] == 'alliance') Info::addAlliance($db, $notif['sender_id']);


            $notif['is_notifcation'] = true;
            $notif['labels'] = [999];
            $notif['mail_id'] = $notif['notification_id'];
            $notif['owner'] = $char_id;
            $notif['fetched'] = true;
            $notif['unixtime'] = strtotime($notif['timestamp']);
            $notif['recipients'] = [['recipient_type' => 'character', 'recipient_id' => $char_id]];
            $notif['from'] = $notif['sender_id'];
            $notif['body'] = $notif['text'];
            $notif['subject'] = $notif['type'];
            unset($notif['type']);
            unset($notif['text']);
            $db->insert('mails', $notif);
            $set_delta = true;
        }
    }
    if ($set_delta) Util::setDelta($db, $char_id);
}


function fail(&$guzzler, $params, $ex)
{
    echo $ex->getCode() . ' ' . $ex->getMessage() . "\n";
    if ($ex->getcode() == 420) {
        $guzzler->finish();
        exit();
    }
}
