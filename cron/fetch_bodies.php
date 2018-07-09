<?php

namespace podmail;

require_once '../init.php';

$guzzler = Util::getGuzzler($config, 5);
$db = $config['db'];

$db->update('mails', ['fetched' => ['$exists' => false]], ['$set' => ['fetched' => false]], ['multi' => true]);
$db->update('mails', ['fetched' => null], ['$set' => ['fetched' => false]], ['multi' => true]);

$minute = date('Hi');
while ($minute == date('Hi')) {
    $unFetched = $db->query('mails', ['fetched' => false], ['sort' => ['mail_id' => -1], 'limit' => 10]);
    foreach ($unFetched as $mail) {
        $params = ['mail_id' => $mail['mail_id']];
        $db->update('mails', ['mail_id' => (int) $mail['mail_id']], ['$set' => ['fetched' => null]], ['multi' => true]);
        $row = $db->queryDoc('scopes', ['scope' => 'esi-mail.read_mail.v1', 'character_id' => $mail['owner']]);

        SSO::getAccessToken($config, $row['character_id'], $row['refresh_token'], $guzzler, '\podmail\success', '\podmail\SSO::fail', $params);
    } 
    if (sizeof($unFetched) == 0) {
        $guzzler->tick();
        usleep(100000);
    }
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
}

function body_fail(&$guzzler, $params, $ex)
{
    $db = $params['config']['db'];
    if ($ex->getCode() == 404) { // Mail not found!
        $db->delete('mails', ['mail_id' => $params['mail_id'], 'owner' => $params['char_id']]);
        echo "Mail not found, purging...\n";
        Util::setDelta($params['config'], $params['char_id']);
    } else ESI::fail($guzzler, $params, $ex);
}

function body_success(&$guzzler, $params, $content)
{
    $mail = json_decode($content, true);
    $db = $params['config']['db'];
    $db->update('mails', ['mail_id' => $params['mail_id']], ['$set' => ['fetched' => true, 'body' => $mail['body']]], ['multi' => true]);
    $notify = [];
    if ($mail['labels'] != [2] && @$mail['is_read'] != true && strtotime($mail['timestamp']) >= (time() - 120)) {
        $info = $db->queryDoc("information", ['id' => (int) $mail['from']]);
        $title = isset($info['name']) ? $info['name'] : 'New EveMail';
        $image = ($info['type'] == 'character_id') ? "https://imageserver.eveonline.com/Character/" . $mail['from'] . "_32.jpg" : "https://podmail.zzeve.com/images/podmail.png";

        $notify = ["title" => $title, "image" => $image, "message" => $mail["subject"], 'mail_id' => $params['mail_id']];
    }
    Util::setDelta($params['config'], (int) $params['char_id'], $notify);
    //echo $params['char_id'] . " fetched  " . $params['mail_id'] . "\n";
}
