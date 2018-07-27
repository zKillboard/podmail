<?php

namespace podmail;

$db = $config['db'];

$key = $args['key'];
$value = $args['value'];
if ($db->count('users', ['character_id' => $char_id]) == 0) $db->insert('users', ['character_id' => $char_id]);
$db->set('users', ['character_id' => $char_id], [$key => $value]);

return $response;
