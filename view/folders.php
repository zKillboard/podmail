<?php

$db = $config['db'];

$row = $db->queryDoc('scopes', ['scope' => 'esi-mail.read_mail.v1', 'character_id' => $char_id]);

$labels = $row['labels'];
$folders = [];
foreach ($labels as $label) {
    $label_id = $label['label_id'];
    $filter = ['owner' => ['$in' => [$char_id]], 'fetched' => true, 'deleted' => false];
    if ($label_id == 999999998) $filter['labels'] = [];
    else if ($label_id != 0) $filter['labels'] = $label_id;
    else $filter['labels'] = ['$ne' => 999999999];

    $filter['is_read'] = false;
    $label['unread'] = $db->count('mails', $filter);
    $folders[$label_id] = $label;
}
ksort($folders);
$notifs = $folders[999999999];
unset($folders[999999999]);

$lists = $row['mail_lists'];
$sort = [];
foreach ($lists as $list) {
    $list_id = $list['mailing_list_id'];
    $list['label_id'] = $list['mailing_list_id'];
    $count = 0; //$db->count('mails', ['owner' => ['$in' => [$char_id]], 'labels' => $list_id, 'fetched' => true]);
    $list['unread'] = $db->count('mails', ['owner' => ['$in' => [$char_id]], 'labels' => $list_id, 'is_read' => false, 'fetched' => true]);
    $sort[$list['name']] = $list;
}
ksort($sort);
$folders = array_merge($folders, $sort);
$folders[] = $notifs;

return $app->view->render($response, 'folders.html', ['folders' => $folders]);
