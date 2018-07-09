<?php

namespace podmail;

require_once '../init.php';

$guzzler = Util::getGuzzler($config, 1);
$db = $config['db'];

$minute = date('Hi');
//while ($minute == date('Hi')) {
    $unFetched = $db->query('information', ['type' => 'mailing_list_id', 'update' => true]);
    $candidates = $db->query('scopes', ['scope' => 'esi-mail.read_mail.v1'], ['sort' => ['_id' => -1], 'limit' => 20]);

    foreach ($candidates as $row) {
        $params = ['row' => $row];
        SSO::getAccessToken($config, $row['character_id'], $row['refresh_token'], $guzzler, '\podmail\success', '\podmail\SSO::fail', $params);
    } 
//}
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
    $guzzler->call($url, '\podmail\mailSuccess', '\podmail\ESI::fail', $params, $headers);
}

function mailSuccess(&$guzzler, $params, $content)
{
    $db = $params['config']['db'];
    $lists = json_decode($content, true);
    foreach ($lists as $list) {
        $id = (int) $list['mailing_list_id'];
        $name = $list['name'];
        $cdoc = $db->queryDoc('information', ['type' => 'mailing_list_id', 'id' => $id]);
        if (!isset($cdoc['update'])) continue;

        echo "List $id => $name\n";
        $db->update('information', ['type' => 'mailing_list_id', 'id' => $id], ['$set' => ['name' => $name], '$unset' => ['character_id' => 1, 'update' => 1]]);
    }
}
