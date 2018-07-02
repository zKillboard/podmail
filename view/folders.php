<?php

$db = $config['db'];

$labels = $db->query('information', ['type' => 'label_id'], ['label_id' => 1]);
$folders = [];
foreach ($labels as $label) {
  $label_id = $label['id'];
  $count = $db->count('mails', ['owner' => $char_id, 'labels' => $label_id]);
  $read = $db->count('mails', ['owner' => $char_id, 'labels' => $label_id, 'is_read' => true]);
  $label['count'] = $count;
  $label['read'] = $read;
  $label['unread'] = $count - $read;
  $folders[] = $label;
}

$lists = $db->query('information', ['type' => 'mailing_list_id'], ['mailing_list_id' => 1]);
foreach ($lists as $list) {
  $list_id = $list['id'];
  $count = $db->count('mails', ['owner' => $char_id, 'labels' => $list_id]);
  $unread = $db->count('mails', ['owner' => $char_id, 'labels' => $list_id, 'is_read' => true]);
  if ($count > 0) {
      $list['count'] = $count;
      $list['read'] = $read;
      $list['unread'] = $count - $read;
      $folders[] = $list;
  }
}

return $app->view->render($response, 'folders.html', ['folders' => $folders]);
