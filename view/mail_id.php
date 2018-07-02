<?php

namespace podmail;

$db = $config['db'];
$id = (int) $args['id'];

$mail = $db->queryDoc('mails', ['owner' => $char_id, 'mail_id' => $id]);
$mail['body'] = str_replace(" style=\"", " syle=\"", $mail['body']);
$mail['body'] = str_replace(" size=\"", " syze=\"", $mail['body']);
$mail['body'] = str_replace(" color=\"", " cilor=\"", $mail['body']);

Info::addInfo($db, $mail);

return $app->view->render($response, 'mail.html', ['mail' => $mail]);
