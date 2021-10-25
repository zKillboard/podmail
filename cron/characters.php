<?php

namespace podmail;

require_once '../init.php';

$db = $config['db'];
$esi = $config['ccp']['esi'];
$guzzler = Util::getGuzzler($config, 5);
$guzzler->setEtagTTL(86400 * 7);

$ttl = 86400 * 6;

$minute = date('Hi');
while ($minute == date('Hi')) {
    $toUpdate = $db->query('information', ['type' => 'character_id', 'lastUpdated' => ['$lte' => (time() - $ttl)]], ['sort' => ['lastUpdated' => 1], 'limit' => 25]);
    foreach ($toUpdate as $row) {
        $char_id = $row['id'];

        // Let's make sure this isn't a mailling list ID first
        $name = Info::getInfoField($db, 'mailing_list_id', $char_id, 'name');
        if ($name != "") {
            $db->delete('information', $row);
            continue;
        }
        if ($row['lastUpdated'] != 0) sleep(1); // slow down
        $db->update('information', $row, ['$set' => ['lastUpdated' => (time() - $ttl + 120)]]);

        $params['row'] = $row;
        $params['config'] = $config;
        $guzzler->call("$esi/v5/characters/$char_id/", '\podmail\success', '\podmail\fail', $params, ['etag' => $config['redis']]);
    }
    $guzzler->tick();
    if (sizeof($toUpdate) == 0) sleep(1);
}
$guzzler->finish();

function fail($guzzler, $params, $ex)
{
    $db = $params['config']['db'];
    $row = $params['row'];
    if ($ex->getCode() == 404) {
        $db->delete('information', $row);
        return;
    }
}

function success($guzzler, $params, $content)
{
    if ($content == "") return;

    $db = $params['config']['db'];
    $character = json_decode($content, true);
    $row = $params['row'];
    $update = ['name' => $character['name'], 'search' => strtolower($character['name']), 'lastUpdated' => time()];
    $update['corporation_id'] = $character['corporation_id'];
    $update['alliance_id'] = (int) @$character['alliance_id'];
    $db->update('information', $row, ['$set' => $update]);
    Info::addCorp($db, $character['corporation_id']);
    $froms = $db->distinct('mails', 'owner', ['from' => $row['id']]);
    foreach ($froms as $char_id) Util::setDelta($params['config'], $char_id);
    $recips = $db->distinct('mails', 'owner', ['recipeints.recipient_id' => $row['id']]);
    foreach ($recips as $char_id) Util::setDelta($params['config'], $char_id);
}
