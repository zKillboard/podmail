<?php

namespace podmail;

class SSO
{
    public static function cleanup($db)
    {
        $db->delete('access_tokens', ['expires' => ['$lte' => time()]]);
    }

    public static function getAccessToken(array $config, int $char_id, string $refresh_token, \cvweiss\Guzzler $guzzler, string $success, string $fail, array $params = [])
    {
        $params['char_id'] = $char_id;
        $params['config'] = $config;
        $params['success'] = $success;
        $params['refresh_token'] = $refresh_token;

        // Do we have a cached version?
        $db = $config['db'];
        self::cleanup($db);

        $row = $db->queryDoc('access_tokens', ['character_id' => $char_id, 'refresh_token' => $refresh_token]);
        if (isset($row['access_token'])) {
            $raw = json_encode(['access_token' => $row['access_token']]);
            $success($guzzler, $params, $raw);
            return;
        }

        $url = 'https://login.eveonline.com/oauth/token';
        $headers = ['Authorization' =>'Basic ' . base64_encode($config['ccp']['clientID'] . ':' . $config['ccp']['secretKey']), "Content-Type" => "application/json"];
        $guzzler->call($url, '\podmail\SSO::accessTokenFetchComplete', $fail, $params, $headers, 'POST', json_encode(['grant_type' => 'refresh_token', 'refresh_token' => $refresh_token]));
    }

    public static function accessTokenFetchComplete($guzzler, $params, $content)
    {
        $json = json_decode($content, true);
        $access_token = $json['access_token'];
        $ttl = $json['expires_in'];
        $params['config']['db']->insert('access_tokens', ['character_id' => $params['char_id'], 'refresh_token' => $params['refresh_token'], 'access_token' => $access_token, 'expires' => (time() + $ttl - 600)]);
        $params['success']($guzzler, $params, $content);
    }

    public static function fail(&$guzzler, $params, $ex)
    {
        $json = json_decode($params['content'], true);
        $db = $params['config']['db'];
        if (@$json['error_description'] == 'The refresh token is expired.') {
            $char_id = $params['char_id'];
            $db->delete('scopes', ['character_id' => $char_id]);
            $db->delete('access_tokens', ['character_id' => $char_id]);
            $db->delete('mails', ['owner' => $char_id]);
            Log::log("Purged $char_id for not having a valid refresh_token");
        } else {
            Log::log("SSO: " . $ex->getCode() . " " . $ex->getMessage());
        }
    }
}
