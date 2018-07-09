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
        return $response;
        break;
    default:
        throw new \InvalidArgumentException("Unknown type: $type");
}

function handleMailAction(array $config, int $char_id, int $id, string $action, string $value)
{
    switch ($action) {
       case 'is_read':
            Mail::setReadStatus($config, $char_id, $id, ($value == 'true')); 
            break;
        case 'delete':
            Mail::delete($config, $char_id, $id);
            break;
    default:
        throw new \InvalidArgumentException("Unknown action: $action");
    }
}
