<?php

namespace podmail;

require_once "../init.php";

if (date('i') != 0) exit();
$db = $config['db'];
$redis = $config['redis'];

$character_ids = $db->distinct("mails", "owner");
foreach ($character_ids as $char_id) {
    $last_seen = $redis->get("podmail:last_seen:$char_id");
    if ($last_seen > 0) {
        $db->update('information', ['id' => $char_id, 'type' => 'character_id'], ['$set' => ['lastUpdated' => 1]]); // Check active users once an hour
        continue;
    }
    $count = $db->count('mails', ['owner' => $char_id]);
    Log::log("Cleaning up $char_id $count");
    $db->delete('scopes', ['character_id' => $char_id]);
    $db->delete('access_tokens', ['character_id' => $char_id]);
    $db->delete('mails', ['owner' => $char_id]);
    $redis->del("podmail:iterate:$char_id");
    $redis->del("podmail:delta:$char_id");
    $redis->del("guzzler:etags:https://esi.evetech.net/v1/characters/$char_id/mail/");
}
