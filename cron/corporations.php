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
        $guzzler->call("$esi/v4/corporations/$corp_id/", '\podmail\success', '\podmail\fail', $params);
    }
    if (sizeof($toUpdate)) $guzzler->finish();
    sleep(1);
}
$guzzler->finish();

function fail($guzzler, $params, $ex)
{
    if ($ex->getcode() == 420) {
        $guzzler->finish();
        exit();
    }
}

function success($guzzler, $params, $content)
{
    $corporation = json_decode($content, true);
    $row = $params['row'];
    if (@$row['name'] != @$corporation['name']) {
        $db = $params['config']['db'];
        $db->update('information', $row, ['$set' => ['name' => $corporation['name'], 'lastUpdated' => time()]]);
    }
}
