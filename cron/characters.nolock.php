<?php

namespace podmail;

require_once '../init.php';

$db = $config['db'];
$esi = $config['ccp']['esi'];
$guzzler = Util::getGuzzler($config);

$chars = [];
$minute = date('Hi');
while ($minute == date('Hi')) {
    $toUpdate = $db->query('information', ['type' => 'character_id', 'lastUpdated' => ['$lte' => (time() - 86400)]], ['sort' => ['lastUpdated' => 1, '_id' => 1], 'limit' => 10]);
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

        $db->update('information', $row, ['$set' => ['lastUpdated' => time()]]);

        $params['row'] = $row;
        $params['config'] = $config;
        $guzzler->call("$esi/v4/characters/$char_id/", '\podmail\success', '\podmail\fail', $params);
    }
    $guzzler->finish();
    if (sizeof($toUpdate) == 0) {
        $guzzler->tick();
        sleep(1);
    }
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
    // Try again in two minutes
    $db->update('information', $row, ['$set' => ['lastUpdated' => (time() - 86400 + 120)]]);
    echo $row['id'] . " failed to retrieve information....\n";
}

function success($guzzler, $params, $content)
{
    $db = $params['config']['db'];
    $character = json_decode($content, true);
    $row = $params['row'];
    $db->update('information', $row, ['$set' => ['name' => $character['name'], 'search' => strtolower($character['name']), 'lastUpdated' => time()]]);
    Info::addCorp($db, $character['corporation_id']);
    $froms = $db->distinct('mails', 'owner', ['from' => $row['id']]);
    foreach ($froms as $char_id) Util::setDelta($params['config'], $char_id);
    $recips = $db->distinct('mails', 'owner', ['recipeints.recipient_id' => $row['id']]);
    foreach ($recips as $char_id) Util::setDelta($params['config'], $char_id);
}
