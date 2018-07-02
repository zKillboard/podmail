<?php

namespace podmail;

$db = $config['db'];
$id = (int) $args['id'];
$mails =  $db->query('mails', ['owner' => $char_id, 'labels' => $id], ['sort' => ['mail_id' => -1], 'limit' => 25]);

Info::addInfo($db, $mails);

return $app->view->render($response, 'mails.html', ['mails' => $mails]);
