<?php

namespace podmail;

require_once "../init.php";

$db = $config['db'];

$information = $db->query('information', ['search' => ['$exists' => false]]);
foreach ($information as $row) {
    $search = (string) @$row['search'];
    $name = strtolower($row['name']);
    if ($search != $name) {
        Log::log("Search: $search != $name");
        $db->update('information', $row, ['$set' => ['search' => $name]]);
    }
}
