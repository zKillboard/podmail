<?php

$db = $config['db'];
$row = $db->queryDoc('delta', ['character_id' => $char_id]);
if ($row['delta'] == 1) {
    $db->update('delta', ['character_id' => $char_id, 'uniq' => $row['uniq']], ['$set' => ['delta' => 0]]);
    $response->getBody()->write('1');
}
return $response;
