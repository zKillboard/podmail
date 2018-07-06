<?php

namespace podmail;

require_once '../init.php';

$db = $config['db'];
$esi = $config['ccp']['esi'];
$guzzler = Util::getGuzzler($config);

$chars = [];
$minute = date('Hi');
while ($minute == date('Hi')) {
    $toUpdate = $db->query('information', ['type' => 'character_id', 'lastUpdated' => ['$lte' => (time() - 86400)]], ['sort' => ['lastUpdated' => 1], 'limit' => 10]);
    foreach ($toUpdate as $row) {
        $char_id = $row['id'];

        // Let's make sure this isn't a mailling list ID first
        $name = Info::getInfoField($db, 'mailing_list_id', $char_id, 'name');
        if ($name != "") {
            $db->delete('information', $row);
            continue;
        }
        if (in_array($char_id, $chars)) { echo ("dupe $char_id\n"); continue; }
        $chars[] = $char_id;

        $params['row'] = $row;
        $params['config'] = $config;
        $guzzler->call("$esi/v4/characters/$char_id/", '\podmail\success', '\podmail\ESI::fail', $params);
    }
    $guzzler->finish();
    if (sizeof($toUpdate) == 0) {
        $guzzler->tick();
        sleep(1);
    }
}
$guzzler->finish();

function success($guzzler, $params, $content)
{
    $db = $params['config']['db'];
    $character = json_decode($content, true);
    $row = $params['row'];
    $db->update('information', $row, ['$set' => ['name' => $character['name'], 'search' => strtolower($character['name']), 'lastUpdated' => time()]]);
    Info::addCorp($db, $character['corporation_id']);
}
