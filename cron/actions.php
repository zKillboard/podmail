<?php

namespace podmail;

require_once '../init.php';

$db = $config['db'];
$guzzler = Util::getGuzzler(1);

$minute = date('Hi');
while ($minute == date('Hi')) {
    $row = $db->queryDoc('actions', ['status' => 'pending']);
    if ($row != null ) {
        $sso = $db->queryDoc('scopes', ['character_id' => $row['character_id'], 'scope' => 'esi-mail.organize_mail.v1']);
        $config['row'] = $row;
        SSO::getAccessToken($config, $row['character_id'], $sso['refresh_token'], $guzzler, '\podmail\success', '\podmail\fail');
        $guzzler->finish();
    } else usleep(100000);
}
$guzzler->finish();

function fail($guzzler, $params, $ex) {
    echo $ex->getCode() . " " . $ex->getMessage() . "\n";
}

function success(&$guzzler, $params, $content) {
    $json = json_decode($content, true);
    $access_token = $json['access_token'];
    $row = $params['config']['row'];

    $char_id = $row['character_id'];
    $mail_id = $row['mail_id'];
    $url = $row['url'];
    $body = @$row['body'];
    $headers = ['Content-Type' => 'application/json', 'Authorization' => "Bearer $access_token"];
    $guzzler->call($url, '\podmail\postSuccess', '\podmail\fail', $params, $headers, $row['type'], $body);
}

function postSuccess($guzzler, $params, $content)
{
    $db = $params['config']['db'];
    $row = $params['config']['row'];
    $mail_id = $params['config']['row']['mail_id'];
    $char_id = $params['config']['row']['character_id'];

    switch ($row['action']) {
        case 'setread':
            $is_read = $row['is_read'] == true;
            $db->update('mails', ['mail_id' => $mail_id], ['$set' => ['is_read' => $is_read]]);
            break;
        case 'delete':
            $db->delete('mails', ['mail_id' => $mail_id]);
    }
    $db->delete('actions', $row);
    Util::setDelta($db, $char_id);
}
