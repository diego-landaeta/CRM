<?php
// Manda un mensaje privado de un usuario a otro, como si lo escribiera en el campus.
// Uso: php mensaje-cli.php <de> <para> <texto>
define('CLI_SCRIPT', true);
require(getenv('MOODLE_CONFIG') ?: '/bitnami/moodle/config.php');
[$_, $de, $para, $texto] = $argv;
$desde = core_user::get_user((int) $de, '*', MUST_EXIST);
\core\session\manager::set_user($desde);
$conv = \core_message\api::get_conversation_between_users([(int) $de, (int) $para]);
if (!$conv) {
    $conv = \core_message\api::create_conversation(\core_message\api::MESSAGE_CONVERSATION_TYPE_INDIVIDUAL, [(int) $de, (int) $para]);
}
$m = \core_message\api::send_message_to_conversation((int) $de, (int) $conv, $texto, FORMAT_PLAIN);
echo "mensaje {$m->id} en conversación {$conv}\n";
