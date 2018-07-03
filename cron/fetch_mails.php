<?php

namespace podmail;

require_once '../init.php';

$guzzler = Util::getGuzzler($config);
$db = $config['db'];

$db->update('mails', ['fetched' => ['$exists' => false]], ['$set' => ['fetched' => false]], ['multi' => true]);
$db->update('mails', ['fetched' => null], ['$set' => ['fetched' => false]], ['multi' => true]);

$count = 0;
$minute = date('Hi');
while ($minute == date('Hi')) {
    $unFetched = $db->query('mails', ['fetched' => false], ['sort' => ['mail_id' => -1], 'limit' => 10]);
    foreach ($unFetched as $mail) {
        $params = ['mail_id' => $mail['mail_id']];
        $db->update('mails', $mail, ['$set' => ['fetched' => null]]);
        $row = $db->queryDoc('scopes', ['scope' => 'esi-mail.read_mail.v1', 'character_id' => $mail['owner']]);

        SSO::getAccessToken($config, $row['character_id'], $row['refresh_token'], $guzzler, '\podmail\success', '\podmail\fail', $params);
        $count++;
    } 
    if (sizeof($unFetched) == 0) {
        $guzzler->tick();
        sleep(1);
    }
}
if ($count > 0) echo "Fetched $count mails\n";
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
    $guzzler->call($url, '\podmail\mailSuccess', '\podmail\fail', $params, $headers);
}

function mailSuccess(&$guzzler, $params, $content)
{
    $mail = json_decode($content, true);
    $params['config']['db']->update('mails', ['mail_id' => $params['mail_id']], ['$set' => ['fetched' => true, 'body' => $mail['body']]]);
}


function fail(&$guzzler, $params, $ex)
{
    echo $ex->getCode() . " " . $ex->getMessage() . "\n";
    if ($ex->getcode() == 420) {
        $guzzler->finish();
        exit();
    }
}
