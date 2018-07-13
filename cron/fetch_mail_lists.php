<?php

namespace podmail;

require_once '../init.php';

$guzzler = Util::getGuzzler($config, 1);
$db = $config['db'];

$minute = date('Hi');
while ($minute == date('Hi')) {
    $db->update('scopes', ['scope' => 'esi-mail.read_mail.v1', 'lastListUpdate' => ['$exists' => false]], ['$set' => ['lastListUpdate' => 0]], ['multi' => true]);
    $rows = $db->query('scopes', ['scope' => 'esi-mail.read_mail.v1', 'lastListUpdate' => ['$lt' => (time() - 3600)]]);
    foreach ($rows as $row) {
        $params = ['row' => $row];
        SSO::getAccessToken($config, $row['character_id'], $row['refresh_token'], $guzzler, '\podmail\success', '\podmail\SSO::fail', $params);
    } 
    $guzzler->finish();
    sleep(1);
    break;
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
    $url = "$esi/v1/characters/$char_id/mail/lists/";
    $guzzler->call($url, '\podmail\listSuccess', '\podmail\ESI::fail', $params, $headers);
}

function listSuccess(&$guzzler, $params, $content)
{
    $db = $params['config']['db'];
    $lists = json_decode($content, true);
    foreach ($lists as $list) {
        $id = (int) $list['mailing_list_id'];
        $name = $list['name'];
        Info::addMailingList($db, $id, $name);
    }
    $db->update("scopes", ['scope' => 'esi-mail.read_mail.v1', 'character_id' => (int) $params['char_id']], ['$set' => ['lastListUpdate' => time(), 'mail_lists' => $lists]]);
    Util::setDelta($params['config'], $params['char_id']);
}
