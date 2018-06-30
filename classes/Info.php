<?php

namespace podmail;

class Info
{
    public static function addChar(Db $db, int $id, string $name = null)
    {
        if ($db->exists("information", ['type' => 'character_id', 'id' => $id]) === false) {
            if ($name == null) $name = "character_id $id";
            $db->insert("information", ['type' => 'character_id', 'id' => $id, 'name' => $name]);
        }
    }

    public static function addScopes(Db $db, int $char_id, string $scopes, string $refresh_token)
    {
        $scopes = explode(' ' , $scopes);
        $db->delete('scopes', ['character_id' => $char_id]);
        foreach ($scopes as $scope) {
            //echo "$char_id $refresh_token<br/>";
            $db->insert('scopes', ['character_id' => $char_id, 'scope' => $scope, 'refresh_token' => $refresh_token]);
        }
    }
}
