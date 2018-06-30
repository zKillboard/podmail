<?php

namespace podmail;

require_once '../init.php';

$guzzler = Util::getGuzzler($config);
$db = $config['db'];


echo "Fetching headers\n";
$minute = date('Hi');
while ($minute == date('Hi')) {
    $db->update('scopes', ['scope' => 'esi-mail.read_mail.v1', 'lastChecked' => ['$exists' => false]], ['$set' => ['lastChecked' => 0]]);
    $scopes = $db->query('scopes', ['scope' => 'esi-mail.read_mail.v1', 'lastChecked' => ['$lte' => time() - 900]]);
    foreach ($scopes as $row) {
        $config['row'] = $row;
        echo "Fetching headers for " . $row['character_id'] . "\n";
        SSO::getAccessToken($config, $row['character_id'], $row['refresh_token'], $guzzler, '\podmail\success', '\podmail\fail');
    }
    if (sizeof($scopes) == 0) {
        $guzzler->tick();
        sleep(1);
    }
}
$guzzler->finish();
echo "Done fetching headers\n";

function success(&$guzzler, $params, $content)
{
    $json = json_decode($content, true);
    $access_token = $json['access_token'];
    $row = $params['config']['row'];
    $params['config']['db']->update('scopes', $row, ['$set' => ['lastChecked' => time()]]);

    doNextCall($params, $access_token, $guzzler);
}

function doNextCall($params, $access_token, &$guzzler)
{
    $params['access_token'] = $access_token;
    $headers = ['Content-Type' => 'application/json', 'Authorization' => "Bearer $access_token"];
    $char_id = $params['char_id'];
    $esi = $params['config']['ccp']['esi'];
    $url = "$esi/v1/characters/$char_id/mail/";
    if (isset($params['last_mail_id'])) $url .= "?last_mail_id=" . $params['last_mail_id'];
    $guzzler->call($url, '\podmail\mailSuccess', '\podmail\fail', $params, $headers);
}

function mailSuccess(&$guzzler, $params, $content)
{
    $char_id = $params['char_id'];
    $db = $params['config']['db'];
    $json = json_decode($content, true);
    $last_mail_id = null;
    foreach ($json as $mail) {
        if ($db->exists("mails", ['mail_id' => $mail['mail_id']]) == false) {
            $mail['owner'] = $char_id;
            $mail['fetched'] = false;
            $mail['unixtime'] = strtotime($mail['timestamp']);
            Info::addChar($db, (int) $mail['from']);
            $recipients = isset($mail['recipients']) ? $mail['recipients'] : [['recipient_type' => $mail['recipient_type'], 'recipient_id' => $mail['recipient_id']]];
            foreach ($recipients as $recipient) {
                if ($recipient['recipient_type'] == 'character') Info::addChar($db, (int) $recipient['recipient_id']);
            }
            $db->insert("mails", $mail);
            $db->update('delta', ['character_id' => $char_id], ['$set' => ['delta' => 1, 'uniq' => uniqid("", true)]]);
            echo "Added $char_id " . $mail['mail_id'] . "\n";
        }
        foreach ($mail['labels'] as $label) {
            if (!$db->exists('labels', ['label_id' => $label])) {
                $db->insert('labels', ['label_id' => $label, 'name' => null, 'character_id' => $char_id]);
            }
        }
        $last_mail_id = $mail['mail_id'];
    }

    if (sizeof($json) >= 50) {
        $params['last_mail_id'] = $last_mail_id;
        doNextCall($params, $params['access_token'], $guzzler);
    }
}


function fail(&$guzzler, $params, $ex)
{
    echo $ex->getCode() . " " . $ex->getMessage();
}
