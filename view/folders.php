<?php

$db = $config['db'];

$row = $db->queryDoc('scopes', ['scope' => 'esi-mail.read_mail.v1', 'character_id' => $char_id]);
$labels = $row['labels'];
$folders = [];
foreach ($labels as $label) {
    $label_id = $label['label_id'];
    $filter = ['owner' => $char_id, 'fetched' => true];
    if ($label_id == 999999998) $filter['labels'] = [];
    else if ($label_id != 0) $filter['labels'] = $label_id;
    else $filter['labels'] = ['$ne' => 999999999];
    $count = $db->count('mails', $filter);

    if ($count == 0 && $label_id == 999999998) continue;

    $filter['is_read'] = true;
    $read = $db->count('mails', $filter);
    $label['count'] = $count;
    $label['read'] = $read;
    $label['unread'] = $count - $read;
    $folders[$label_id] = $label;
}

$lists = $db->query('information', ['type' => 'mailing_list_id'], ['mailing_list_id' => 1]);
foreach ($lists as $list) {
    $list_id = $list['id'];
    $list['label_id'] = $list['id'];
    $count = $db->count('mails', ['owner' => $char_id, 'labels' => $list_id, 'fetched' => true]);
    $read = $db->count('mails', ['owner' => $char_id, 'labels' => $list_id, 'is_read' => true, 'fetched' => true]);
    if ($count > 0) {
        $list['count'] = $count;
        $list['read'] = $read;
        $list['unread'] = $count - $read;
        $folders[$list_id] = $list;
    }
}
ksort($folders);

return $app->view->render($response, 'folders.html', ['folders' => $folders]);
