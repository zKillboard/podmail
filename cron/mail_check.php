<?php

namespace podmail;

require_once '../init.php';

$guzzler = Util::getGuzzler($config, 25);
$db = $config['db'];

$db->update('mails', ['fetched' => true, 'last_checked' => ['$exists' => false]], ['$set' => ['last_checked' => 0]], ['multi' => true]);

$minute = date('Hi');
while ($minute == date('Hi')) {
    $unChecked = $db->query('mails', ['fetched' => true, 'last_checked' => ['$lt' => (time() - 86400)], 'labels' => ['$ne' => 999999999]], ['sort' => ['last_checked' => 1], 'limit' => 10]);
    foreach ($unChecked as $mail) {
        $params = ['mail_id' => $mail['mail_id']];
        $row = $db->queryDoc('scopes', ['scope' => 'esi-mail.read_mail.v1', 'character_id' => $mail['owner']]);

        SSO::getAccessToken($config, $row['character_id'], $row['refresh_token'], $guzzler, '\podmail\success', '\podmail\SSO::fail', $params);
    }
    $guzzler->finish();
    if (sizeof($unChecked) == 0) sleep(1);
}
$guzzler->finish();

function success(&$guzzler, $params, $content)
{
    $json = json_decode($content, true);
    $access_token = $json['access_token'];
    $mail_id = $params['mail_id'];

    $params['access_token'] = $access_token;
    $headers = ['Content-Type' => 'application/json', 'Authorization' => "Bearer $access_token"];
    $char_id = $params['char_id'];
    $esi = $params['config']['ccp']['esi'];
    $url = "$esi/v1/characters/$char_id/mail/$mail_id/";
    $guzzler->call($url, '\podmail\body_success', '\podmail\body_fail', $params, $headers);
    Util::setDelta($params['config'], $params['char_id']);
}

function body_fail(&$guzzler, $params, $ex)
{
    $db = $params['config']['db'];
    if ($ex->getCode() == 404) { // Mail not found!
        Log::log("Removing " . $params['mail_id']);
        $db->delete('mails', ['mail_id' => $params['mail_id'], 'owner' => $params['char_id']]);
        Util::setDelta($params['config'], $params['char_id']);
    } else {
        Log::log("error " . $params['mail_id']);
        ESI::fail($guzzler, $params, $ex);
    }
    sleep(1);
}

function body_success(&$guzzler, $params, $content)
{
    $db = $params['config']['db'];
    $db->update('mails', ['mail_id' => $params['mail_id'], 'owner' => $params['char_id']], ['$set' => ['last_checked' => time()]], ['multi' => true]);
    /*$mail = json_decode($content, true);
    $db = $params['config']['db'];
    $db->update('mails', ['mail_id' => $params['mail_id']], ['$set' => ['fetched' => true, 'purge' => false, 'body' => $mail['body']]], ['multi' => true]);
    $notify = [];
    if ($mail['labels'] != [2] && @$mail['is_read'] != true && strtotime($mail['timestamp']) >= (time() - 120)) {
        $info = $db->queryDoc("information", ['id' => (int) $mail['from']]);
        $title = (isset($info['name']) && $info['name'] != "?") ? $info['name'] : 'New EveMail';
        $image = ($info['type'] == 'character_id') ? "https://imageserver.eveonline.com/Character/" . $mail['from'] . "_32.jpg" : "https://podmail.zzeve.com/images/podmail.png";

        $notify = ["title" => $title, "image" => $image, "message" => $mail["subject"], 'mail_id' => $params['mail_id'], 'unixtime' => strtotime($mail['timestamp']), 'uniqid' => uniqid("", true)];
    }
    Util::setDelta($params['config'], (int) $params['char_id'], $notify);*/
}
