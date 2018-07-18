<?php

namespace podmail;

class Log
{
    public static function log(string $content)
    {
        $isCLI = (php_sapi_name() == "cli");
        $out = date("Y-m-d H:i:s") . " > $content\n";


        $logfile = "./cron/logs/log.log";
        if ($isCLI) echo $out;
        else if (is_writable($logfile)) error_log($out, 3, $logfile);
    }
}
