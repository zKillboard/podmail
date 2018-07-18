<?php

namespace podmail;

class SSO
{
    public static function getAccessToken(array $config, int $char_id, string $refresh_token, \cvweiss\Guzzler $guzzler, string $success, string $fail, array $params = [])
    {
        $params['char_id'] = $char_id;
        $params['config'] = $config;
        $params['success'] = $success;
        $params['refresh_token'] = $refresh_token;

        // Do we have a cached access token?
        $redis = $config['redis'];
        $access_token = $redis->get("podmail:access_token:$char_id:$refresh_token");
        if ($access_token != null) {
            $raw = json_encode(['access_token' => $access_token]);
            $success($guzzler, $params, $raw);
            return;
        }

        // Not cached...
        $url = 'https://login.eveonline.com/oauth/token';
        $headers = ['Authorization' =>'Basic ' . base64_encode($config['ccp']['clientID'] . ':' . $config['ccp']['secretKey']), "Content-Type" => "application/json"];
        $guzzler->call($url, '\podmail\SSO::accessTokenFetchComplete', $fail, $params, $headers, 'POST', json_encode(['grant_type' => 'refresh_token', 'refresh_token' => $refresh_token]));
    }

    public static function accessTokenFetchComplete($guzzler, $params, $content)
    {
        $char_id = $params['char_id'];
        $refresh_token = $params['refresh_token'];
        $redis = $params['config']['redis'];

        $json = json_decode($content, true);
        $access_token = $json['access_token'];

        $redis->setex("podmail:access_token:$char_id:$refresh_token", 600, $access_token);
        $params['success']($guzzler, $params, $content);
    }

    public static function fail(&$guzzler, $params, $ex)
    {
        $json = json_decode($params['content'], true);
        $db = $params['config']['db'];
        if (@$json['error_description'] == 'The refresh token is expired.') {
            $char_id = $params['char_id'];
            $db->delete('scopes', ['character_id' => $char_id]);
            $db->delete('mails', ['owner' => $char_id]);
            Log::log("Purged $char_id for not having a valid refresh_token");
        } else {
            switch ($ex->getCode()) {
                case 403:
                case 502: 
                case 503:
                    // Do nothing
                    break;
                default:
                    Log::log("SSO: " . $ex->getCode() . " " . $ex->getMessage());
            }
        }
    }
}
