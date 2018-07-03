<?php

namespace podmail;

$db = $config['db'];
$id = (int) $args['id'];
$page = (int) $args['page'];
$filter = ['owner' => $char_id];
if ($id != 0) $filter['labels'] = $id;
else $filter['labels'] = ['$ne' => 999];
$mails =  $db->query('mails', $filter, ['sort' => ['mail_id' => -1], 'limit' => 25, 'skip' => ($page * 25)]);
$count = $db->count('mails', $filter);
$max = ceil($count / 25);

$iterated = false;
if ($count == 0) {
    $row = $db->queryDoc('scopes', ['scope' => 'esi-mail.read_mail.v1', 'character_id' => $char_id]);
    $iterated = (bool) @$row['iterated'];
}

Info::addInfo($db, $mails);

return $app->view->render($response, 'mails.html', ['mails' => $mails, '$id' => $id, 'count' => $count, 'page' => (1 + $page), 'max' => $max, 'iterated' => $iterated]);
