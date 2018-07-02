<?php
exit();

namespace podmail;

require_once '../init.php';

$guzzler = Util::getGuzzler($config, 1);
$db = $config['db'];

$minute = date('Hi');
while ($minute == date('Hi')) {
    $unFetched = $db->query('information', ['type' => 'mailing_list_id', 'update' => true]);
    foreach ($unFetched as $list) {
        $params = ['mailing_list_id' => $list['id']];
        $row = $db->queryDoc('scopes', ['scope' => 'esi-mail.read_mail.v1', 'character_id' => $list['character_id']]);

        SSO::getAccessToken($config, $row['character_id'], $row['refresh_token'], $guzzler, '\podmail\success', '\podmail\fail', $params);
        break;
    } 
    if (sizeof($unFetched) == 0) {
        $guzzler->tick();
        sleep(1);
    } else $guzzler->finish();
}
$guzzler->finish();

function success(&$guzzler, $params, $content)
{
    $json = json_decode($content, true);
    $access_token = $json['access_token'];
    $list_id = $params['mailing_list_id'];

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
        echo "List $id => $name\n";
        $db->update('information', ['type' => 'mailing_list_id', 'id' => $id], ['$set' => ['name' => $name], '$unset' => ['character_id' => 1, 'update' => 1]]);
    }
}


function fail(&$guzzler, $params, $ex)
{
    if ($ex->getcode() == 420) {
        $guzzler->finish();
        exit();
    }
}
