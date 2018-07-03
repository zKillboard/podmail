<?php

namespace podmail;

require_once '../init.php';

$db = $config['db'];
$esi = $config['ccp']['esi'];
$guzzler = Util::getGuzzler($config);

$minute = date('Hi');
while ($minute == date('Hi')) {
    $toUpdate = $db->query('information', ['type' => 'character_id', 'lastUpdated' => ['$lte' => (time() - 86400)]], ['limit' => 100]);
    foreach ($toUpdate as $row) {
        $char_id = $row['id'];

        // Let's make sure this isn't a mailling list ID first
        $name = Info::getInfoField($db, 'mailing_list_id', $char_id, 'name');
        if ($name != "") {
            $db->delete('information', $row);
            continue;
        }


        $params['row'] = $row;
        $params['config'] = $config;
        $guzzler->call("$esi/v4/characters/$char_id/", '\podmail\success', '\podmail\fail', $params);
    }
    if (sizeof($toUpdate)) $guzzler->finish();
    sleep(1);
}
$guzzler->finish();

function fail($guzzler, $params, $ex)
{
    echo $ex->getCode() . " " . $ex->getMessage() . "\n";
    if ($ex->getcode() == 420) {
        $guzzler->finish();
        exit();
    }
}

function success($guzzler, $params, $content)
{
    $character = json_decode($content, true);
    $row = $params['row'];
    if (@$row['name'] != @$character['name']) {
        $db = $params['config']['db'];
        $db->update('information', $row, ['$set' => ['name' => $character['name'], 'lastUpdated' => time()]]);
    }
}
