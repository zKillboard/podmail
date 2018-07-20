<?php

namespace podmail;

class Util 
{
    public static function getGuzzler($config, $maxConcurrent = 10)
    {
        return new \cvweiss\Guzzler($maxConcurrent, 1, 'podmail - ' . $config['domain']);
    }

    public static function setDelta(array $config, int $char_id, array $notification = [])
    {
        $redis = $config['redis'];

        $update = ['uniq' => uniqid("", true)];
        $key = "podmail:delta:$char_id";
        $current = unserialize($redis->get($key));
        if (sizeof($notification) == 0 && isset($current['notification'])) $update['notification'] = $current['notification'];

        if (sizeof($notification) > 0) {
            $update['notification']  = $notification;
        }
        $redis->setex("podmail:delta:$char_id", (86400 * 7), serialize($update));
    }

    public static function removeMailingLists(Db $db, array $labels)
    {
        $retVal = [];
        foreach ($labels as $label_id) {
           if ($db->exists('information', ['type' => 'mailing_list_id', 'id' => $label_id])) continue;
           if ($label_id >= 10000000) continue;
           $retVal[] = $label_id;
        }
        return $retVal;
    }
}
