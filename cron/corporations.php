<?php

namespace podmail;

require_once "../init.php";

$db = $config['db'];
$esi = $config['ccp']['esi'];
$guzzler = Util::getGuzzler($config);

$minute = date('Hi');
while ($minute == date('Hi')) {
    $toUpdate = $db->query('information', ['type' => 'corporation_id', 'lastUpdated' => ['$lte' => (time() - 86400)]], ['limit' => 100]);
    foreach ($toUpdate as $row) {
        $corp_id = $row['id'];
        $params['row'] = $row;
        $params['config'] = $config;
        $guzzler->call("$esi/v4/corporations/$corp_id/", '\podmail\success', '\podmail\ESI::fail', $params);
    }
    if (sizeof($toUpdate)) $guzzler->finish();
    sleep(1);
}
$guzzler->finish();

function success($guzzler, $params, $content)
{
    $corporation = json_decode($content, true);
    $row = $params['row'];
    $db = $params['config']['db'];
    $db->update('information', $row, ['$set' => ['name' => $corporation['name'], 'search' => strtolower($corporation['name']), 'lastUpdated' => time()]]);
    Info::addAlliance($db, @$corporation['alliance_id']);
}
