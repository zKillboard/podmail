<?php

namespace podmail;

$db = $config['db'];

$form_recips = trim($request->getParsedBodyParam('recipients'));
$form_subject = trim($request->getParsedBodyParam('subject'));
$form_body = trim($request->getParsedBodyParam('body'));

if ($form_recips == "") return sendStatus($response, "Please provide recipient(s)...", true);
if ($form_subject == "") return sendStatus($response, "Please provide a subject...", true);
if ($form_body == "") return sendStatus($response, "Please provide a message body...", true);

$form_body .= "<br/><br/>---<br/>Sent using <a href='https://podmail.zzeve.com/'>PodMail</a>.";

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
        if (!isset($json['character'])) return sendStatus($response, "Unable to determine character_id for $name", true);
        $chars = $json['character'];
        $recipient = ['id' => $chars[0], 'type' => 'character_id'];
        //$db->insert('information', ['type' => 'character_id', 'id' => (int) $chars[0], 'lastUpdated' => 0]);
    }
    $type = str_replace('_id', '', $recipient['type']);
    $recips[] = ['recipient_id' => $recipient['id'], 'recipient_type' => str_replace('_id', '', $recipient['type'])];
}
$mail['recipients'] = $recips;

$url = $config['ccp']['esi'] . "/v1/characters/$char_id/mail/";

$action = ['action' => 'send_mail', 'url' => $url, 'type' => 'post', 'character_id' => $char_id, 'body' => json_encode($mail), 'status' => 'pending'];
$db->insert('actions', $action);

return sendStatus($response, "Your EveMail has been queued for sending...");

function sendStatus($response, string $message, bool $is_error = false)
{
    return $response->withHeader('Content-type', 'application/json')->getBody()->write(json_encode(["message" => $message, "error" => $is_error], JSON_PRETTY_PRINT));
}
