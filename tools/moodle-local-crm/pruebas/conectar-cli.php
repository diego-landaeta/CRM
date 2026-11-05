<?php
// Conecta el campus local con el CRM como lo haría la página «Conectar con el CRM».
// Uso: php conectar-cli.php <codigo>
define('CLI_SCRIPT', true);
require('/bitnami/moodle/config.php');
$admin = get_admin();
\core\session\manager::set_user($admin);
$r = \local_crm\conexion::conectar($argv[1], context_system::instance(), (int) $admin->id);
echo json_encode($r, JSON_UNESCAPED_UNICODE), "\n";
$t = $DB->get_records_sql("SELECT t.userid, u.username FROM {external_tokens} t JOIN {external_services} s ON s.id = t.externalserviceid
    JOIN {user} u ON u.id = t.userid WHERE s.shortname = 'local_crm'");
echo 'tokens: ', json_encode(array_values($t)), "\n";
