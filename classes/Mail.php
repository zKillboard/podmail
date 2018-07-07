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
            if (in_array(999999999, $mail['labels'])) {
                $db->update('mails', $mail, ['$set' => ['is_read' => $is_read]]);
                Util::setDelta($db, $char_id);
            } else {
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
}
