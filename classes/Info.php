<?php

namespace podmail;

class Info
{
    public static function addChar(Db $db, int $id, string $name = null)
    {
        if ($db->exists('information', ['type' => 'character_id', 'id' => $id]) === false) {
            if ($name == null) $name = "character_id $id";
            $db->insert('information', ['type' => 'character_id', 'id' => $id, 'name' => $name, 'lastUpdated' => 0]);
        }
    }

    public static function addCorp(Db $db, int $id, string $name = null)
    {   
        if ($db->exists('information', ['type' => 'corporation_id', 'id' => $id]) === false) {
            if ($name == null) $name = "corporation $id";
            $db->insert('information', ['type' => 'corporation_id', 'id' => $id, 'name' => $name, 'lastUpdated' => 0]);
        }
    }

    public static function addAlliance(Db $db, int $id, string $name = null)
    {   
        if ($db->exists('information', ['type' => 'alliance_id', 'id' => $id]) === false) {
            if ($name == null) $name = "alliance $id";
            $db->insert('information', ['type' => 'alliance_id', 'id' => $id, 'name' => $name, 'lastUpdated' => 0]);
        }
    }

    public static function addScopes(Db $db, int $char_id, string $scopes, string $refresh_token)
    {
        $scopes = explode(' ' , $scopes);
        $db->delete('scopes', ['character_id' => $char_id]);
        foreach ($scopes as $scope) {
            $db->insert('scopes', ['character_id' => $char_id, 'scope' => $scope, 'refresh_token' => $refresh_token, 'lastChecked' => 0]);
        }
    }

    public static function addLabel(Db $db, int $char_id, int $label_id)
    {
        if ($db->exists('information', ['type' => 'label_id', 'id' => $label_id]) === false) {
            echo "Adding label $label_id\n";
            $db->insert('information', ['type' => 'label_id', 'id' => $label_id, 'name' => "label $label_id", 'character_id' => $char_id, 'update' => true]);
        }
    }

    public static function addMailingList(Db $db, int $char_id, int $mailing_list_id)
    {   
        if ($db->exists('information', ['type' => 'mailing_list_id', 'id' => $mailing_list_id]) === false) {
            echo "Adding mailing list: $mailing_list_id\n";
            $db->insert('information', ['type' => 'mailing_list_id', 'id' => $mailing_list_id, 'name' => "mail list $mailing_list_id", 'character_id' => $char_id, 'update' => true]);
        }
    }

    public static function addRecipient(Db $db, int $char_id, array $recipient)
    {
        $type = $recipient['recipient_type'];
        switch ($type) {
            case 'character':
                return self::addChar($db, $recipient['recipient_id']);
            case 'corporation':
                return self::addCorp($db, $recipient['recipient_id']);
            case 'alliance':
                return self::addAlliance($db, $recipient['recipient_id']);
            case 'mailing_list':
                return self::addMailingList($db, $char_id, $recipient['recipient_id']);
            default:
                echo "Unknown recipient type:\n" . print_r($recipient, true) . "\n";
                throw new \IllegalArguementException("Unknown recipient type:\n" . print_r($recipient, true));
        }
    }

    public static function getInfoField(Db $db, string $type, int $id, string $field)
    {
        $row = self::getInfo($db, $type, $id);
        return @$row[$field];
    }

    public static function getInfo(Db $db, string $type, int $id)
    {
        return $db->queryDoc('information', ['type' => $type, 'id' => $id]);
    }

    public static function addInfo(Db $db, array &$element)
    {  
        foreach ($element as $key => $value) {
            $class = is_object($value) ? get_class($value) : null;
            if ($class == 'MongoDB\BSON\ObjectID') continue;
            if (is_array($value)) $element[$key] = self::addInfo($db, $value);
            elseif ($value != 0) {
                switch ($key) {
                    case "_id":
                    case "mail_id":
                    case "owner":
                    case "fetched":
                    case "unixtime":
                    case "is_read":
                    case "subject":
                        break;
                    case "from":
                        $element['from_name'] = self::getInfoField($db, 'character_id', $value, 'name');
                        break;    
                    case "recipient_id":
                        $element['recipient_name'] = self::getInfoField($db, 'character_id', $value, 'name');
                        break;
                    case 'timestamp':
                        $element['dttm'] = date('Y-m-d H:i', $element['unixtime']);
                        break;
                    default: 
                        //echo "Unknown key: $key => $value"; die();
                }
            }
        }
        return $element;
    }
}
