<?php

namespace podmail;

require_once '../init.php';

$db = $config['db'];
$guzzler = Util::getGuzzler(1);
$lastMailSent = 0;

$minute = date('Hi');
while ($minute == date('Hi')) {
    $row = $db->queryDoc('actions', ['status' => 'pending']);
    if ($row != null ) {
        $scope = null;
        switch ($row['action']) {
            case 'send_evemail':
                $scope = 'esi-mail.send_mail.v1';
                if ($lastMailSent >= (time() - 13)) continue;
                $lastMailSent = time(); // Send mails every 13 seconds...
                break;
            default:
                $scope = 'esi-mail.organize_mail.v1';
                break;
        }
        $db->update('actions', $row, ['$set' => ['status' => 'in progress']]);
        $sso = $db->queryDoc('scopes', ['character_id' => $row['character_id'], 'scope' => $scope]);
        $config['row'] = $row;
        SSO::getAccessToken($config, $row['character_id'], $sso['refresh_token'], $guzzler, '\podmail\success', '\podmail\SSO::fail');
    } 
    $guzzler->tick();
    usleep(100000);
}
$guzzler->finish();

function success(&$guzzler, &$params, $content) {
    $json = json_decode($content, true);
    $access_token = $json['access_token'];
    $row = $params['config']['row'];

    $url = $row['url'];
    $body = @$row['body'];
    $headers = ['Content-Type' => 'application/json', 'Authorization' => "Bearer $access_token"];
    $guzzler->call($url, '\podmail\postSuccess', '\podmail\ESI::fail', $params, $headers, $row['type'], $body);
}

function fail($guzzler, $params, $ex)
{
    $db = $params['config']['db'];
    $row = $params['config']['row'];
    $db->update('actions', $row, ['status' => 'failed', 'code' => $ex->getCode(), 'message' => $ex->getMessage()]);
}

function postSuccess($guzzler, $params, $content)
{
    $db = $params['config']['db'];
    $row = $params['config']['row'];
    $mail_id = @$params['config']['row']['mail_id'];
    $char_id = $params['config']['row']['character_id'];

    switch ($row['action']) {
        case 'send_mail':
            echo "$char_id sent eve_mail " . $content . "\n";
            break;
        case 'setread':
            $is_read = ($row['is_read'] == true);
            $db->update('mails', ['owner' => $char_id, 'mail_id' => $mail_id], ['$set' => ['is_read' => $is_read]]);
            echo "$char_id is_read $mail_id " . ($is_read ? "true" : "false") . "\n";
            break;
        case 'delete':
            $db->delete('mails', ['owner' => $char_id, 'mail_id' => $mail_id]);
            echo "$char_id deleted $mail_id\n";
            break;
    }
    $db->delete('actions', $row);
    Util::setDelta($params['config'], $char_id);
}
