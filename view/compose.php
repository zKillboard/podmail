<?php

namespace podmail;

$db = $config['db'];

$form_recips = trim($request->getParsedBodyParam('recipients'));
$form_subject = trim($request->getParsedBodyParam('subject'));
$form_body = trim($request->getParsedBodyParam('body'));

if ($form_recips == "") return sendStatus($app, $response, "Please provide recipient(s)...", true);
if ($form_subject == "") return sendStatus($app, $response, "Please provide a subject...", true);
if ($form_body == "") return sendStatus($app, $response, "Please provide a message body...", true);

if (strpos($form_body, "PodMail") === false) $form_body .= "<br/><br/>---<br/>Sent using <a href='https://podmail.zzeve.com/'>PodMail</a>.";

$mail = ['subject' => trim($form_subject), 'body' => trim($form_body), "approved_cost" => ((int) 10000)];

$form_recips = explode(',', $form_recips);
$recips = [];
foreach ($form_recips as $form_recip) {
    $name = trim($form_recip);
    $recipient = $db->queryDoc('information', ['search' => $name]);
    if ($recipient == null) {
        $esi = $config['ccp']['esi'];
        $raw = ESI::curl($config, "$esi/v2/search/", ['categories' => 'character', 'search' => $name, 'strict' => true]);
        $json = json_decode($raw, true);
        if (!isset($json['character'])) return sendStatus($app, $response, "Unable to determine character_id for $name", true);
        $chars = $json['character'];
        $recipient = ['id' => $chars[0], 'type' => 'character_id'];
    }
    $type = str_replace('_id', '', $recipient['type']);
    $recips[] = ['recipient_id' => $recipient['id'], 'recipient_type' => str_replace('_id', '', $recipient['type'])];
}
$mail['recipients'] = $recips;

$url = $config['ccp']['esi'] . "/v1/characters/$char_id/mail/";

$action = ['action' => 'send_mail', 'url' => $url, 'type' => 'post', 'character_id' => $char_id, 'body' => json_encode($mail), 'status' => 'pending'];
$db->insert('actions', $action);

return sendStatus($app, $response, "Your EveMail has been queued for sending...");

function sendStatus($app, $response, string $message, bool $is_error = false)
{
    return $app->view->render($response->withHeader('Content-type', 'application/json'), 'json.twig', ['json' => json_encode(["message" => $message, "error" => $is_error], JSON_PRETTY_PRINT)]);
}
