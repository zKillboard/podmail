<?php

namespace podmail;

require_once '../init.php';

$guzzler = Util::getGuzzler($config, 1);
$db = $config['db'];

$minute = date('Hi');
//while ($minute == date('Hi')) {
    $unFetched = $db->queryDoc('information', ['type' => 'mailing_list_id', 'update' => true]);
    $candidates = $db->query('scopes', ['scope' => 'esi-mail.read_mail.v1'], ['sort' => ['_id' => -1], 'limit' => 20]);

    foreach ($candidates as $row) {
        $params = ['row' => $row];
        SSO::getAccessToken($config, $row['character_id'], $row['refresh_token'], $guzzler, '\podmail\success', '\podmail\fail', $params);
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
    $guzzler->call($url, '\podmail\mailSuccess', '\podmail\fail', $params, $headers);
}

function mailSuccess(&$guzzler, $params, $content)
{
    $db = $params['config']['db'];
    $lists = json_decode($content, true);
    foreach ($lists as $list) {
        $id = $list['mailing_list_id'];
        $name = $list['name'];
        $cname = Info::getInfoField('mailing_list_id', $id, 'name');
        if ($name != $cname) {
            echo "List $id => $name\n";
            $db->update('information', ['type' => 'mailing_list_id', 'id' => $id], ['$set' => ['name' => $name], '$unset' => ['character_id' => 1, 'update' => 1]]);
            $db->update('delta', [], ['$set' => ['delta' => 1, 'uniq' => uniqid("", true)]]);

        }
    }
}


function fail(&$guzzler, $params, $ex)
{
    echo $ex->getCode() . " " . $ex->getMessage() . "\n";
    if ($ex->getcode() == 420) {
        $guzzler->finish();
        exit();
    }
}
