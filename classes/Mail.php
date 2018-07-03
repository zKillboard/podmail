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
            $db->insert('actions', ['mail_id' => $mail_id, 'character_id' => $char_id, 'action' => 'setread', 'status' => 'pending', 'type' => 'put', 'url' => "$esi/v1/characters/$char_id/mail/$mail_id/", 'body' => json_encode(['labels' => [], 'read' => $is_read]), 'is_read' => $is_read]);
        }
    }

    public static function delete(array $config, int $char_id, int $mail_id)
    {
        $esi = $config['ccp']['esi'];
        $db = $config['db'];
        $mail = $db->queryDoc('mails', ['owner' => $char_id, 'mail_id' => $mail_id]);
        if ($mail != null) {
            $db->update('mails', $mail, ['$set' => ['deleted' => true]]);
            $db->insert('actions', ['mail_id' => $mail_id, 'character_id' => $char_id, 'action' => 'delete', 'status' => 'pending', 'type' => 'delete', 'url' => "$esi/v1/characters/$char_id/mail/$mail_id/"]);
        }
    }
}
