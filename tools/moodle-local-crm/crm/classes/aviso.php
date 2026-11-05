<?php
// This file is part of Moodle - https://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.

/**
 * local_crm: la mensajería del campus, unida al CRM (CRM #679).
 *
 * @package    local_crm
 * @copyright  2026 ISEIE Innovation School
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace local_crm;

defined('MOODLE_INTERNAL') || die();

/**
 * El aviso que recibe el CRM por cada mensaje privado del campus.
 *
 * Lleva quién escribe, a quién, el texto y si cada uno es «personal» del campus
 * (tutor, profesor, gestor o administrador). Con eso el CRM distingue la duda de
 * un alumno a su tutora, la respuesta de la tutora escrita en el campus y los
 * mensajes entre alumnos (que no le importan).
 *
 * Va firmado: cabecera `X-Crm-Firma: t=<unix>,v1=<hex>`, con
 * v1 = HMAC-SHA256(secreto, "<t>.<cuerpo>"). El CRM rechaza la firma que no
 * cuadre o que tenga más de 5 minutos.
 */
class aviso {
    /** Los arquetipos de rol que cuentan como personal del campus. */
    const ARQUETIPOS_PERSONAL = ['editingteacher', 'teacher', 'manager', 'coursecreator'];

    public static function configurado(): bool {
        return trim((string) get_config('local_crm', 'url')) !== ''
            && trim((string) get_config('local_crm', 'secreto')) !== '';
    }

    /** ¿Es personal del campus (y no alumno)? */
    public static function es_personal(int $userid): bool {
        global $DB;
        if (is_siteadmin($userid)) {
            return true;
        }
        [$sql, $params] = $DB->get_in_or_equal(self::ARQUETIPOS_PERSONAL, SQL_PARAMS_NAMED);
        $params['userid'] = $userid;
        return $DB->record_exists_sql(
            "SELECT 1 FROM {role_assignments} ra JOIN {role} r ON r.id = ra.roleid
              WHERE ra.userid = :userid AND r.archetype $sql", $params);
    }

    /** Lo que el CRM necesita de un usuario. */
    private static function usuario(int $userid): ?array {
        $u = \core_user::get_user($userid, 'id, firstname, lastname, email, deleted');
        if (!$u || $u->deleted) {
            return null;
        }
        return [
            'id'       => (int) $u->id,
            'nombre'   => fullname($u),
            'email'    => $u->email,
            'personal' => self::es_personal((int) $u->id),
        ];
    }

    /**
     * El aviso de un mensaje, o null si no va al CRM: borrado, de una conversación
     * de grupo o la de uno consigo mismo.
     */
    public static function del_mensaje(int $mensajeid): ?array {
        global $DB, $CFG;
        $m = $DB->get_record('messages', ['id' => $mensajeid]);
        if (!$m) {
            return null;
        }
        $conv = $DB->get_record('message_conversations', ['id' => $m->conversationid], 'id, type');
        if (!$conv || (int) $conv->type !== \core_message\api::MESSAGE_CONVERSATION_TYPE_INDIVIDUAL) {
            return null;
        }
        $de = self::usuario((int) $m->useridfrom);
        if (!$de) {
            return null;
        }
        $para = [];
        $miembros = $DB->get_fieldset_select('message_conversation_members', 'userid',
            'conversationid = ? AND userid <> ?', [$conv->id, $m->useridfrom]);
        foreach ($miembros as $id) {
            if ($u = self::usuario((int) $id)) {
                $para[] = $u;
            }
        }
        if (!$para) {
            return null;
        }
        $html = trim((string) $m->fullmessagehtml) !== ''
            ? $m->fullmessagehtml
            : format_text($m->fullmessage, $m->fullmessageformat, ['context' => \context_system::instance()]);
        return [
            'evento'  => 'mensaje',
            'sitio'   => $CFG->wwwroot,
            'mensaje' => [
                'id'              => (int) $m->id,
                'conversacion_id' => (int) $conv->id,
                // El curso, si la conversación se abrió desde «Entrar al chat» de un curso:
                // el CRM solo pasa la consulta a tutoras de ese curso.
                'curso_id'        => chat_directo::curso_de((int) $conv->id),
                'html'            => $html,
                'fecha'           => (int) $m->timecreated,
            ],
            'de'      => $de,
            'para'    => $para,
        ];
    }

    /** La firma del cuerpo, tal y como la comprueba el CRM. */
    public static function firma(string $cuerpo, string $secreto, int $t): string {
        return 't=' . $t . ',v1=' . hash_hmac('sha256', $t . '.' . $cuerpo, $secreto);
    }

    /**
     * Lo manda al CRM. Si el CRM no contesta o falla (5xx, 408, 429), excepción: la tarea se
     * reintenta. Si lo rechaza (otro 4xx: clave cambiada, campus desconectado, aviso que no
     * entiende), reintentar no lo arregla: se apunta y se descarta.
     */
    public static function enviar(array $aviso): void {
        global $CFG;
        require_once($CFG->libdir . '/filelib.php');
        $url = trim((string) get_config('local_crm', 'url'));
        $secreto = trim((string) get_config('local_crm', 'secreto'));
        $cuerpo = json_encode($aviso, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $curl = new \curl();
        $curl->setHeader([
            'Content-Type: application/json',
            'X-Crm-Firma: ' . self::firma($cuerpo, $secreto, time()),
        ]);
        $respuesta = $curl->post($url, $cuerpo, ['CURLOPT_TIMEOUT' => 15, 'CURLOPT_CONNECTTIMEOUT' => 5]);
        $codigo = (int) ($curl->get_info()['http_code'] ?? 0);
        if (!$curl->get_errno() && $codigo >= 400 && $codigo < 500 && !in_array($codigo, [408, 429], true)) {
            if (function_exists('mtrace')) {
                mtrace('local_crm: el CRM ha rechazado el aviso (HTTP ' . $codigo . '); no se reintenta.');
            }
            return;
        }
        if ($curl->get_errno() || $codigo < 200 || $codigo >= 300) {
            $detalle = $curl->get_errno() ? $curl->error : ('HTTP ' . $codigo . ' ' . substr((string) $respuesta, 0, 200));
            throw new \moodle_exception('errorenvio', 'local_crm', '', $detalle);
        }
    }
}
