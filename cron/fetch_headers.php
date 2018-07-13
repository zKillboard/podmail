<?php

namespace podmail;

require_once '../init.php';

$guzzler = Util::getGuzzler($config, 10);
$db = $config['db'];
$redis = $config['redis'];

$iterated = [];
$minute = date('Hi');
while ($minute == date('Hi')) {
    $scopes = $db->query('scopes', ['scope' => 'esi-mail.read_mail.v1', 'lastChecked' => ['$lt' => (time() - 31)]]);
    foreach ($scopes as $row) {
        $char_id = $row['character_id'];
        $config['row'] = $row;
        if ($redis->set("podmail:iterate:$char_id", "true", ['nx', 'ex' => 3600]) === true || $row['lastChecked'] == 0) {
            echo "Iterating $char_id\n";
            $config['iterate'] = true;
            $iterated[] = $char_id;
            $db->update('mails', ['owner' => $char_id, 'labels' => ['$ne' => 999999999]], ['$set' => ['purge' => true]], ['multi' => true]);
        }
        $db->update('scopes', $row, ['$set' => ['lastChecked' => time()]]); // Push ahead just in case of error
        SSO::getAccessToken($config, $row['character_id'], $row['refresh_token'], $guzzler, '\podmail\success', '\podmail\SSO::fail');
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
    $params['iterate'] = (bool) @$params['config']['iterate'];
    $guzzler->call($url, '\podmail\mailSuccess', '\podmail\ESI::fail', $params, $headers);
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
            $mail['deleted'] = false;
            $mail['purge'] = false;
            $mail['lastChecked'] = time();
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
            $cmail = $db->queryDoc('mails', ['owner' => $char_id, 'mail_id' => $mail['mail_id']]);
            if ($params['iterate'] == true && @$cmail['purge'] == true) $db->update('mails', $cmail, ['$set' => ['purge' => false]]);
            $filtered = Util::removeMailingLists($db, $cmail['labels']);
            if ($mail['labels'] != $filtered) {
                //echo $mail['mail_id'] . "\n" . print_r($mail['labels'], true) . print_r($filtered, true);
                //$db->update('mails', $cmail, ['$set' => ['labels' => $mail['labels']]]);
                //$set_delta = true;
            }
            if ($cmail['is_read'] != $mail['is_read']) {
                $db->update('mails', $cmail, ['$set' => ['is_read' => $mail['is_read']]]);
                $set_delta = true;
            }
        }
        $current_mail_id = $mail['mail_id'];
        $tcount++;
    }

    if (sizeof($json) >= 50 && ($count > 0 || $params['iterate'] == true)) {
        $params['tcount'] = $tcount;
        $params['last_mail_id'] = $current_mail_id;
        doNextCall($params, $params['access_token'], $guzzler);
    } else if ($params['iterate'] == true) {
        $purgeCount = $db->count('mails', ['owner' => $char_id, 'purge' => true]);
        if ($purgeCount) echo "$char_id Purge $purgeCount mails. (dry run)\n";
        $db->update('scopes', $params['config']['row'], ['$set' => ['iterated' => true]]);
    } else $db->update('scopes', $params['config']['row'], ['$set' => ['lastChecked' => time()]]);
    if ($count > 0) echo $char_id . " Added $count mails\n";
    if ($set_delta) Util::setDelta($params['config'], $char_id);
}
