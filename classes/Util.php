<?php

namespace podmail;

class Util 
{
    public static function getGuzzler($config, $maxConcurrent = 10)
    {
        return new \cvweiss\Guzzler($maxConcurrent, 1, 'podmail - ' . $config['domain']);
    }

    public static function setDelta(Db $db, int $char_id)
    {
        $db->update('delta', ['character_id' => $char_id], ['$set' => ['delta' => 1, 'uniq' => uniqid("", true)]]);
    }

    public static function removeMailingLists(Db $db, array $labels)
    {
        $retVal = [];
        foreach ($labels as $label_id) {
           if ($db->exists('information', ['type' => 'mailing_list_id', 'id' => $label_id])) continue;
           $retVal[] = $label_id;
        }
        return $retVal;
    }
}
