<?php

namespace podmail;

require_once "../init.php";

$db = $config['db'];
$esi = $config['ccp']['esi'];
$guzzler = Util::getGuzzler($config);

$minute = date('Hi');
while ($minute == date('Hi')) {
    $toUpdate = $db->query('information', ['type' => 'alliance_id', 'lastUpdated' => ['$lte' => (time() - 86400)]], ['limit' => 100]);
    foreach ($toUpdate as $row) {
        $alli_id = $row['id'];
        $params['row'] = $row;
        $params['config'] = $config;
        $db->update('information', $row, ['$set' => ['lastUpdated' => (time() - 86400 + 120)]]);
        $guzzler->call("$esi/v3/alliances/$alli_id/", '\podmail\success', '\podmail\ESI::fail', $params, ['etag' => $config['redis']]);
    }
    if (sizeof($toUpdate)) $guzzler->finish();
    sleep(1);
}
$guzzler->finish();

function success($guzzler, $params, $content)
{
    if ($content == "") return;

    $alliance = json_decode($content, true);
    $row = $params['row'];
    $db = $params['config']['db'];
    $db->update('information', $row, ['$set' => ['name' => $alliance['name'], 'search' => strtolower($alliance['name']), 'lastUpdated' => time()]]);
}
