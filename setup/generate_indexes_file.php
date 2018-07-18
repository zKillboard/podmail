<?php

namespace podmail;

require_once '../init.php';

$db = $config['db'];

$mcollections = $db->query("system.namespaces");
$collections = array();
foreach ($mcollections as $collection) {
    if (\substr_count($collection['name'], '.') > 1) continue;
    $colName = str_replace($config['mongo']['db'] . '.', '', $collection['name']);
    $collections[$colName] = $collection;
}
$json = [];
foreach ($collections as $coll => $name) {
    $json[$coll][] = $db->get_indexes($coll);
}
file_put_contents("./setup/indexes.json", json_encode($json));
