<?php

namespace podmail;

$db = $config['db'];
$mail_id = (int) $args['id'];

$mail = $db->queryDoc('mails', ['owner' => $char_id, 'mail_id' => $mail_id]);
$mail['body'] = str_replace(" style=\"", " syle=\"", $mail['body']);
$mail['body'] = str_replace(" size=\"", " syze=\"", $mail['body']);
$mail['body'] = str_replace(" color=\"", " cilor=\"", $mail['body']);
$mail['body'] = str_replace("\n", '<br/>', $mail['body']);
$mail['body'] = str_replace("href=\"killReport:", "target='_blank' href=\"https://zkillboard.com/kill/", $mail['body']);

Info::addInfo($db, $mail);
Mail::setReadStatus($config, $char_id, $mail_id, true);

return $app->view->render($response, 'mail.html', ['mail' => $mail]);
