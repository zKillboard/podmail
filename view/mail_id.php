<?php

namespace podmail;

if ($char_id == 0) return $response->withStatus(302)->withRedirect('/');

$db = $config['db'];
$mail_id = (int) $args['id'];

$mail = $db->queryDoc('mails', ['owner' => ['$in' => [$char_id]], 'mail_id' => $mail_id]);
if (!isset($mail['body'])) $mail['body'] = Mail::fetch_body($config, $char_id, $mail_id);
$mail['mail_id'] = $mail_id;
$mail['body'] = str_replace(" style=\"", " stile=\"", $mail['body']);
$mail['body'] = str_replace(" size=\"", " syze=\"", $mail['body']);
$mail['body'] = str_replace(" color=\"", " colour=\"", $mail['body']);
$mail['body'] = str_replace("\n", '<br/>', $mail['body']);
$mail['body'] = str_replace("href=\"killReport:", "target='_blank' href=\"https://zkillboard.com/kill/", $mail['body']);
$mail['body'] = str_replace("href=\"showinfo:2//", "href=\"https://evewho.com/corpid/", $mail['body']);
$mail['body'] = str_replace("href=\"showinfo:5//", "href=\"https://zkillboard.com/system/", $mail['body']);
$mail['body'] = str_replace("href=\"showinfo:1373//", "href=\"https://evewho.com/pilotid/", $mail['body']);
$mail['body'] = str_replace("href=\"showinfo:1375//", "href=\"https://evewho.com/pilotid/", $mail['body']);
$mail['body'] = str_replace("href=\"showinfo:1377//", "href=\"https://evewho.com/pilotid/", $mail['body']);
$mail['body'] = str_replace("href=\"showinfo:1383//", "href=\"https://evewho.com/pilotid/", $mail['body']);
$mail['body'] = str_replace("href=\"http", "target='_blank' href=\"http", $mail['body']);
$mail['body'] = str_replace("href='http", "target='_blank' href='http", $mail['body']);

Info::addInfo($db, $mail);
Mail::setReadStatus($config, $char_id, $mail_id, true);

return $app->view->render($response, 'mail.html', ['mail' => $mail]);
