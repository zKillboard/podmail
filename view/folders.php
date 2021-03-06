<?php

$db = $config['db'];

$row = $db->queryDoc('scopes', ['scope' => 'esi-mail.read_mail.v1', 'character_id' => $char_id]);

if (!isset($row['labels'])) return $response;
$labels = $row['labels'];
$folders = [];
foreach ($labels as $label) {
    $label_id = $label['label_id'];
    $filter = ['owner' => ['$in' => [$char_id]], 'deleted' => false];
    if ($label_id == 999999998) $filter['labels'] = [];
    else if ($label_id == 999999997) {
        $filter['is_read'] = false;
        $filter['labels'] = ['$ne' => 999999999];
    }
    else if ($label_id != 0) $filter['labels'] = $label_id;
    else $filter['labels'] = ['$ne' => 999999999];

    //if (!$db->exists('mails', $filter)) continue;
    $filter['is_read'] = false;
    $label['unread'] = $db->count('mails', $filter);
    $folders[$label_id] = $label;
}
$allMail = $folders[0];
unset($folders[0]);
$notifs = $folders[999999999];
unset($folders[999999999]);
ksort($folders);

$lists = $row['mail_lists'];
$sort = [];
foreach ($lists as $list) {
    $list_id = $list['mailing_list_id'];
    $list['label_id'] = $list['mailing_list_id'];
    $count = 0;
    $list['unread'] = $db->count('mails', ['owner' => ['$in' => [$char_id]], 'labels' => $list_id, 'is_read' => false]);
    $sort[$list['name']] = $list;
}
ksort($sort);
$folders = array_merge($folders, $sort);
$folders[] = $allMail;
$folders[] = $notifs;

return $app->view->render($response, 'folders.html', ['folders' => $folders]);
