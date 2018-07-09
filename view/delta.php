<?php

$db = $config['db'];
$row = $db->queryDoc('deltas', ['character_id' => $char_id]);
if ($row == null) {
    $db->insert('deltas',  ['character_id' => $char_id, 'uniq' => null]);
} else {
    // Don't use $row, prevents atomicity
    $db->update('deltas', ['character_id' => $char_id, 'uniq' => $row['uniq']], ['$set' => ['delta' => 0]]);
}

return $response->withHeader('Content-type', 'application/json')->getBody()->write(json_encode(['delta' => @$row['uniq']]));
