<?php

namespace podmail;

require_once '../init.php';

$guzzler = Util::getGuzzler($config);
$db = $config['db'];

if (!$db->exists('information', ['type' => 'label_id', 'id' => 999999999])) {
    $db->insert('information', ['type' => 'label_id', 'id' => 999999999, 'name' => 'Notifications']);
}

$minute = date('Hi');
while ($minute == date('Hi')) {
    $db->update('scopes', ['scope' => 'esi-characters.read_notifications.v1', 'lastNotifChecked' => ['$exists' => false]], ['$set' => ['lastNotifChecked' => 0]], ['multi' => true]);
    $scopes = $db->query('scopes', ['scope' => 'esi-characters.read_notifications.v1', 'lastNotifChecked' => ['$lte' => (time() - 900)]]);
    foreach ($scopes as $row) {
        $config['row'] = $row;
        SSO::getAccessToken($config, $row['character_id'], $row['refresh_token'], $guzzler, '\podmail\success', '\podmail\SSO::fail');
        $db->update('scopes', $row, ['$set' => ['lastNotifChecked' => time()]]); 
    }
    $guzzler->tick();
    sleep(1);
    break;
}
$guzzler->finish();

function success(&$guzzler, $params, $content)
{
    $json = json_decode($content, true);
    $access_token = $json['access_token'];
    $row = $params['config']['row'];
    $params['config']['db']->update('scopes', $row, ['$set' => ['lastNotifChecked' => time()]]);

    doNextCall($params, $access_token, $guzzler);
}

function doNextCall($params, $access_token, &$guzzler)
{
    $params['access_token'] = $access_token;
    $headers = ['Content-Type' => 'application/json', 'Authorization' => "Bearer $access_token", 'etag' => $params['config']['redis']];
    $char_id = $params['char_id'];
    $esi = $params['config']['ccp']['esi'];
    $url = "$esi/v3/characters/$char_id/notifications/";
    if (isset($params['last_mail_id'])) $url .= "?last_mail_id=" . $params['last_mail_id'];
    $guzzler->call($url, '\podmail\mailSuccess', '\podmail\ESI::fail', $params, $headers);
}

function mailSuccess(&$guzzler, $params, $content)
{
    if ($content == "") return;

    $set_delta = false;
    $db = $params['config']['db'];
    $json = json_decode($content, true);
    $char_id = $params['char_id'];
    $count = 0;
    $notify = [];
    foreach ($json as $notif) {
        $notif_mail = ['mail_id' => $notif['notification_id'], 'owner' => $char_id];
        $unixtime = strtotime($notif['timestamp']);
        if ($unixtime < (time() - (86400 * 30))) continue;

        if (!$db->exists('mails', $notif_mail)) {
            if ($notif['sender_type'] == 'character') Info::addChar($db, $notif['sender_id']);
            if ($notif['sender_type'] == 'corporation') Info::addCorp($db, $notif['sender_id']);
            if ($notif['sender_type'] == 'alliance') Info::addAlliance($db, $notif['sender_id']);

            if (!isset($notif['is_read'])) $notif['is_read'] = false;
            $notif['is_notifcation'] = true;
            $notif['labels'] = [999999999];
            $notif['mail_id'] = $notif['notification_id'];
            $notif['owner'] = $char_id;
            $notif['fetched'] = true;
            $notif['deleted'] = false;
            $notif['unixtime'] = strtotime($notif['timestamp']);
            $notif['recipients'] = [['recipient_type' => 'character', 'recipient_id' => $char_id]];
            $notif['from'] = $notif['sender_id'];
            $notif['body'] = $notif['text'];
            $notif['subject'] = $notif['type'];
            unset($notif['type']);
            unset($notif['text']);
            $db->insert('mails', $notif);
            $set_delta = true;
            $count++;

            $image = "https://podmail.zzeve.com/images/podmail.png";
            if (sizeof($notify) == 0) $notify = ["title" => "EVE Notification", "image" => $image, "message" => $notif["subject"], 'mail_id' => $notif['mail_id'], 'unixtime' => $notif['unixtime'], 'uniqid' => uniqid("", true)];
        }
    }
    $set_delta |= (bool) $db->delete('mails', ['owner' => $char_id, 'labels' => 999999999, 'unixtime' => ['$lt' => (time() - (86400 * 30))]]);
    if ($set_delta) Util::setDelta($params['config'], $char_id, $notify);
    if ($count) Log::log("$char_id added $count notifications");
}
