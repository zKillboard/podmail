<?php

namespace podmail;

require_once '../init.php';

$guzzler = Util::getGuzzler($config);
$db = $config['db'];

$db->update('scopes', ['scope' => 'esi-mail.read_mail.v1'], ['$set' => ['lastChecked' => 0]], ['multi' => true]);

$minute = date('Hi');
while ($minute == date('Hi')) {
    $scopes = $db->query('scopes', ['scope' => 'esi-mail.read_mail.v1', 'lastChecked' => 0]);
    foreach ($scopes as $row) {
        $config['row'] = $row;
        $db->update('mails', ['owner' => $row['character_id']], ['$set' => ['purge' => true]], ['multi' => true]);
        SSO::getAccessToken($config, $row['character_id'], $row['refresh_token'], $guzzler, '\podmail\success', '\podmail\fail');
        $db->update('scopes', $row, ['$set' => ['lastChecked' => time()]]); // Push ahead just in case of error
    }
    if (sizeof($scopes) == 0) {
        $guzzler->tick();
        sleep(1);
    }
}
$guzzler->finish();

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
    $count = 0;
    $tcount = (int) @$params['tcount'];
    $current_mail_id = 0;
    $char_id = $params['char_id'];
    $db = $params['config']['db'];
    $json = json_decode($content, true);
    $set_delta = false;
    foreach ($json as $mail) {
        if (!isset($mail['is_read'])) $mail['is_read'] = false;
        if ($db->exists("mails", ['owner' => $char_id, 'mail_id' => $mail['mail_id']]) == false) {
            $mail['owner'] = $char_id;
            $mail['fetched'] = false;
            $mail['unixtime'] = strtotime($mail['timestamp']);
            $mail['purge'] = false;
            Info::addChar($db, (int) $mail['from']);
            $recipients = isset($mail['recipients']) ? $mail['recipients'] : [['recipient_type' => $mail['recipient_type'], 'recipient_id' => $mail['recipient_id']]];
            foreach ($recipients as $recipient) Info::addRecipient($db, $char_id, $recipient);
            foreach ($mail['labels'] as $label) Info::addLabel($db, $char_id, $label);
            foreach ($recipients as $recipient) {
                if ($recipient['recipient_type'] == "mailing_list") $mail['labels'][] = $recipient['recipient_id'];
            }
            $db->insert("mails", $mail);
            $set_delta = true;
            $count++;
        } else {
            $db->update('mails', ['owner' => $char_id, 'mail_id' => $mail['mail_id']], ['$set' => ['purge' => false]]);
            $cmail = $db->queryDoc('mails', ['owner' => $char_id, 'mail_id' => $mail['mail_id']]);
            if ($cmail['is_read'] != $mail['is_read']) {
                $db->update('mails', $cmail, ['$set' => ['is_read' => $mail['is_read']]]);
                $set_delta = true;
            }
        }
        $current_mail_id = $mail['mail_id'];
        $tcount++;
    }

    if (sizeof($json) >= 50 && $tcount < 1500) {
        $params['tcount'] = $tcount;
        $params['last_mail_id'] = $current_mail_id;
        doNextCall($params, $params['access_token'], $guzzler);
    } else {
        $purge = $db->delete('mails', ['owner' => $char_id, 'purge' => true]);
        if ($purge > 0) $set_delta = true;
    }
    if ($count > 0) echo $char_id . " Added $count mails\n";
    if ($set_delta) Util::setDelta($db, $char_id);
}


function fail(&$guzzler, $params, $ex)
{
    echo $ex->getCode() . " " . $ex->getMessage() . "\n";
    if ($ex->getcode() == 420) {
        $guzzler->finish();
        exit();
    }
}
