<?php

namespace podmail;

require_once "../init.php";

$db = $config['db'];
$json = json_decode(file_get_contents("./setup/indexes.json"), true);
foreach ($json as $coll => $indexes) {
    echo "$coll\n";
    $indexes = $indexes[0];
    foreach ($indexes as $index) {
        if (sizeof($index['key']) == 1 && isset($index['key']['_id'])) continue;
        print_r($db->add_index($coll, $index['key'], (bool) @$index['unique']));
    }
}
