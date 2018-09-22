<?php

namespace podmail;

if ($request->isGet()) {
    //return $response->withStatus(302)->withRedirect('/');
}

$db = $config['db'];

$search = trim($request->getParsedBodyParam('search'));

$mails = [];
$infoResult = $db->query("information", ['$text' => [ '$search' => $search ]], ['limit' => 25]);
foreach ($infoResult as $row) {
    $mailResult = $db->query("mails", ['owner' => $char_id, '$or' => [ ['from' => $row['id']], ['recipient.recipient_id' => $row['id']]]], ['sort' => ['mail_id' => -1], 'limit' => 25]);
    foreach ($mailResult as $mail) $mails[$mail['mail_id']] = $mail;
}
$mailResult = $db->query("mails", ['$text' => [ '$search' => $search ]], ['sort' => ['mail_id' => -1], 'limit' => 25]);
foreach ($mailResult as $mail) $mails[$mail['mail_id']] = $mail;

Info::addInfo($db, $mails);

return $app->view->render($response, 'mails.html', ['folder' => [], 'mails' => $mails, '$id' => 0, 'count' => $count, 'page' => 1, 'max' => 1, 'iterated' => $iterated]);
