<?php

namespace podmail;

$db = $config['db'];
$type = $args['type'];
$id = (int) $args['id'];
$action = $args['action'];
$value = $args['value'];

switch ($type) {
    case 'mail':
        handleMailAction($config, $char_id, $id, $action, $value);
        break;
    default:
        throw \IllegalArguementException("Unknown type: $type");
}

function handleMailAction(array $config, int $char_id, int $id, string $action, string $value)
{
    switch ($action) {
       case 'is_read':
            Mail::markReadStatus($config, $char_id, $id, ($value == 'read')); 
            break;
        case 'delete':
            Mail::delete($config, $char_id, $id);
            break;
    default:
        throw \IllegalArguementException("Unknown action: $action");
    }
}
