<?php

namespace podmail;

class Mail
{
    public static function setReadStatus(array $config, int $char_id, int $mail_id, bool $is_read)
    {
        $esi = $config['ccp']['esi'];
        $db = $config['db'];
        $mail = $db->queryDoc('mails', ['owner' => $char_id, 'mail_id' => $mail_id]);
        if ($mail != null && $mail['is_read'] != $is_read) {
            $db->update('mails', $mail, ['$set' => ['is_read' => $is_read]]);
            Util::setDelta($config, $char_id);
            if (!in_array(999999999, $mail['labels'])) { // Can't change status of notifications
                $db->insert('actions', ['mail_id' => $mail_id, 'character_id' => $char_id, 'action' => 'setread', 'status' => 'pending', 'type' => 'put', 'url' => "$esi/v1/characters/$char_id/mail/$mail_id/", 'body' => json_encode(['labels' => Util::removeMailingLists($db, $mail['labels']), 'read' => $is_read]), 'is_read' => $is_read]);
            }
        }
    }

    public static function delete(array $config, int $char_id, int $mail_id)
    {
        $esi = $config['ccp']['esi'];
        $db = $config['db'];
        $mail = $db->queryDoc('mails', ['owner' => $char_id, 'mail_id' => $mail_id]);
        if ($mail != null) {
            if (@$mail['is_notification'] == true) return;
            $db->update('mails', $mail, ['$set' => ['deleted' => true]]);
            $db->insert('actions', ['mail_id' => $mail_id, 'character_id' => $char_id, 'action' => 'delete', 'status' => 'pending', 'type' => 'delete', 'url' => "$esi/v1/characters/$char_id/mail/$mail_id/"]);
        }
    }

    public static function fetch_body(array $config, int $owner, int $mail_id) {
        $db = $config['db'];
        $mail = $db->queryDoc('mails', ['owner' => $owner, 'mail_id' => $mail_id]);
        if (!isset($mail['body'])) {
                $guzzler = Util::getGuzzler($config);
                $params = ['mail_id' => $mail['mail_id']];
                $db->update('mails', ['mail_id' => (int) $mail['mail_id']], ['$set' => ['fetched' => null]], ['multi' => true]);
                $row = $db->queryDoc('scopes', ['scope' => 'esi-mail.read_mail.v1', 'character_id' => $owner]);

                SSO::getAccessToken($config, $row['character_id'], $row['refresh_token'], $guzzler, '\podmail\Mail::success', '\podmail\SSO::fail', $params);
                $guzzler->finish();
                $mail = $db->queryDoc('mails', ['owner' => $owner, 'mail_id' => $mail_id]);
        }
        if (!isset($mail['body'])) return "An error occurred while attempting to retrive the content of this evemail...";
        return $mail['body'];
    }

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
        $guzzler->call($url, '\podmail\Mail::body_success', '\podmail\Mail::body_fail', $params, $headers);
        Util::setDelta($params['config'], $params['char_id']);
    }

    public static function body_fail(&$guzzler, $params, $ex)
    {
        $db = $params['config']['db'];
        if ($ex->getCode() == 404) { // Mail not found!
            $db->delete('mails', ['mail_id' => $params['mail_id'], 'owner' => $params['char_id']]);
            echo "Mail not found, purging...\n";
            Util::setDelta($params['config'], $params['char_id']);
        } else ESI::fail($guzzler, $params, $ex);
    }

    public static function body_success(&$guzzler, $params, $content)
    {
        $mail = json_decode($content, true);
        $db = $params['config']['db'];
        $db->update('mails', ['mail_id' => $params['mail_id']], ['$set' => ['fetched' => true, 'purge' => false, 'body' => $mail['body']]], ['multi' => true]);
        $notify = [];
        if ($mail['labels'] != [2] && @$mail['is_read'] != true && strtotime($mail['timestamp']) >= (time() - 120)) {
            $info = $db->queryDoc("information", ['id' => (int) $mail['from']]);
            $title = isset($info['name']) ? $info['name'] : 'New EveMail';
            $image = ($info['type'] == 'character_id') ? "https://imageserver.eveonline.com/Character/" . $mail['from'] . "_32.jpg" : "https://podmail.zzeve.com/images/podmail.png";

            $notify = ["title" => $title, "image" => $image, "message" => $mail["subject"], 'mail_id' => $params['mail_id'], 'unixtime' => time(), 'uniqid' => uniqid("", true)];
        }
        Util::setDelta($params['config'], (int) $params['char_id'], $notify);
    }
}
