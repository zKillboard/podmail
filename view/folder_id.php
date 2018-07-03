<?php

namespace podmail;

$db = $config['db'];
$id = (int) $args['id'];
$filter = ['owner' => $char_id];
if ($id != 0) $filter['labels'] = $id;
else $filter['labels'] = ['$ne' => 999];
$mails =  $db->query('mails', $filter, ['sort' => ['mail_id' => -1], 'limit' => 25]);

Info::addInfo($db, $mails);

return $app->view->render($response, 'mails.html', ['mails' => $mails]);
