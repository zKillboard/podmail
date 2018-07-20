<?php

namespace podmail;

class Info
{
    public static function addChar(Db $db, int $id, string $name = "?")
    {
        if ($id <= 0) return;
        if ($db->exists('information', ['type' => 'character_id', 'id' => $id]) === false) {
            $db->insert('information', ['type' => 'character_id', 'id' => $id, 'name' => $name, 'lastUpdated' => 0]);
        }
    }

    public static function addCorp(Db $db, int $id, string $name = "?")
    {   
        if ($id <= 0) return;
        if ($db->exists('information', ['type' => 'corporation_id', 'id' => $id]) === false) {
            $db->insert('information', ['type' => 'corporation_id', 'id' => $id, 'name' => $name, 'lastUpdated' => 0]);
        }
    }

    public static function addAlliance(Db $db, int $id, string $name = "?")
    {   
        if ($id <= 0) return;
        if ($db->exists('information', ['type' => 'alliance_id', 'id' => $id]) === false) {
            $db->insert('information', ['type' => 'alliance_id', 'id' => $id, 'name' => $name, 'lastUpdated' => 0]);
        }
    }

    public static function addScopes(Db $db, int $char_id, string $scopes, string $refresh_token)
    {
        $scopes = explode(' ' , $scopes);
        foreach ($scopes as $scope) {
            if (!$db->exists('scopes', ['character_id' => $char_id, 'scope' => $scope])) {
                $db->insert('scopes', ['character_id' => $char_id, 'scope' => $scope, 'refresh_token' => $refresh_token, 'lastChecked' => 0]);
            }
        }
        // Just to be sure, make sure they all have the same refresh_token
        $db->update('scopes', ['character_id' => $char_id], ['$set' => ['refresh_token' => $refresh_token]], ['multi' => true]);
    }

    public static function addLabel(Db $db, int $char_id, int $label_id)
    {
        return;
        if ($db->exists('information', ['type' => 'label_id', 'id' => $label_id]) === false) {
            Log::log("Adding label $label_id");
            $db->insert('information', ['type' => 'label_id', 'id' => $label_id, 'name' => "label $label_id", 'character_id' => $char_id, 'update' => true]);
        }
    }

    public static function addMailingList(Db $db, int $mailing_list_id, string $name = "?")
    {   
        if ($db->exists('information', ['type' => 'mailing_list_id', 'id' => $mailing_list_id]) === false) {
            Log::log("Adding mailing list: $mailing_list_id");
            $db->insert('information', ['type' => 'mailing_list_id', 'id' => $mailing_list_id, 'name' => $name]);
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
                return; 
                return self::addMailingList($db, $recipient['recipient_id']);
            default:
                Log::log("Unknown recipient type:\n" . print_r($recipient, true));
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
                    case "from":
                        $name = self::getInfoField($db, 'character_id', $value, 'name');
                        if ($name == "") $name = self::getInfoField($db, 'corporation_id', $value, 'name');
                        if ($name == "") $name = self::getInfoField($db, 'alliance_id', $value, 'name');
                        if ($name == "") $name = self::getInfoField($db, 'mailing_list_id', $value, 'name');

                        if ($name == null) $name = self::getInfoField($db, 'corporation_id', $value, 'name');
                        $element['from_name'] = $name;
                        break;    
                    case "recipient_id":
                        $name = self::getInfoField($db, 'character_id', $value, 'name');
                        if ($name == "") $name = self::getInfoField($db, 'corporation_id', $value, 'name');
                        if ($name == "") $name = self::getInfoField($db, 'alliance_id', $value, 'name');
                        if ($name == "") $name = self::getInfoField($db, 'mailing_list_id', $value, 'name');

                        $element['recipient_name'] = $name;
                        break;
                    case 'timestamp':
                        $element['dttm'] = date('Y.m.d H:i', $element['unixtime']);
                        if (date('YMd', $element['unixtime']) == date('YMd', time())) {
                            $element['timeago'] = date('g:i A', $element['unixtime']);
                        } else if(date('Y', $element['unixtime']) == date('Y', time())) {
                            $element['timeago'] = date('M d', $element['unixtime']);
                        } else {
                            $element['timeago'] = date('M d, Y', $element['unixtime']);
                        }
                        $element['fancytime'] = date('D, F d, Y H:i', $element['unixtime']);
                        break;
                    case 'corporation_id':
                        $element['corporation_name'] = Info::getInfoField($db, 'corporation_id', $value, "name");
                        break;
                    case "alliance_id":
                        $element['alliance_name'] = Info::getInfoField($db, 'alliance_id', $value, 'name');
                        break;
                }
            }
        }
        return $element;
    }
}
