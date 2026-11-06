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
 * El chat directo alumno ↔ tutora.
 *
 * «Entrar al chat» de la actividad Chat del curso ya no abre la sala: abre la
 * conversación PRIVADA del alumno con una tutora de ESE curso. Nada de salas ni de
 * conversaciones de grupo: dos personas.
 *
 * Qué tutora:
 *   1. la de su conversación más reciente con una tutora del curso (no se rompe el hilo);
 *   2. si no tiene ninguna, una de las del curso, repartidas de forma estable;
 *   y siempre entre las DISPONIBLES: profesoras del curso (con o sin edición), con la
 *   matrícula activa, sin las cuentas excluidas por nombre («Inspector…») y sin las que
 *   el CRM ha marcado «No disponible».
 *
 * Si una tutora no está, el CRM pasa la consulta a otra del mismo curso, que responde
 * en SU conversación directa con el alumno; la próxima vez, el botón lleva a esa.
 */
class chat_directo {

    /** ¿Está encendido? (ajuste «chat_directo»; de serie, sí). */
    public static function activo(): bool {
        $v = get_config('local_crm', 'chat_directo');
        return $v === false || (bool) $v;
    }

    /** Los ids de Moodle que el CRM ha marcado «No disponible». */
    public static function no_disponibles(): array {
        $v = (string) get_config('local_crm', 'no_disponibles');
        return array_values(array_filter(array_map('intval', explode(',', $v))));
    }

    /** Los roles de tutora: los de profesor, con y sin permiso de edición. */
    public static function roles_tutora(): array {
        $ids = [];
        foreach (['editingteacher', 'teacher'] as $arquetipo) {
            foreach (get_archetype_roles($arquetipo) as $r) {
                $ids[] = (int) $r->id;
            }
        }
        return array_values(array_unique($ids));
    }

    /**
     * Las tutoras del curso: rol de profesora EN el curso y matrícula activa, sin las
     * excluidas por nombre. Con `$disponibles`, sin las «No disponible» del CRM.
     *
     * @return \stdClass[] indexado por id
     */
    public static function tutoras(\context_course $contexto, bool $disponibles = true): array {
        global $DB;
        $roles = self::roles_tutora();
        if (!$roles) {
            return [];
        }
        [$insql, $params] = $DB->get_in_or_equal($roles, SQL_PARAMS_NAMED);
        $params['ctx'] = $contexto->id;
        $campos = \core_user\fields::for_name()->get_sql('u', false, '', '', false)->selects;
        $gente = $DB->get_records_sql(
            "SELECT DISTINCT u.id, $campos
               FROM {role_assignments} ra
               JOIN {user} u ON u.id = ra.userid
              WHERE ra.contextid = :ctx AND ra.roleid $insql AND u.deleted = 0 AND u.suspended = 0", $params);
        if (!$gente) {
            return [];
        }
        $activos = get_enrolled_users($contexto, '', 0, 'u.id', null, 0, 0, true);
        $gente = array_intersect_key($gente, $activos);
        $excluir = \core_text::strtolower(trim((string) (get_config('local_crm', 'excluir_nombre') ?: 'Inspector')));
        $fuera = $disponibles ? array_flip(self::no_disponibles()) : [];
        return array_filter($gente, function ($u) use ($excluir, $fuera) {
            if (isset($fuera[(int) $u->id])) {
                return false;
            }
            return $excluir === '' || \core_text::strpos(\core_text::strtolower(fullname($u)), $excluir) !== 0;
        });
    }

    /** ¿Es tutora de ese curso (aunque esté «No disponible»)? */
    public static function es_tutora(\context_course $contexto, int $userid): bool {
        return isset(self::tutoras($contexto, false)[$userid]);
    }

    /**
     * La tutora para este alumno en este curso, o null si no hay ninguna disponible.
     */
    public static function elegir(\context_course $contexto, int $alumnoid): ?\stdClass {
        global $DB;
        $tutoras = self::tutoras($contexto);
        if (!$tutoras) {
            return null;
        }
        // 1. La de su conversación más reciente con una tutora del curso.
        [$insql, $params] = $DB->get_in_or_equal(array_keys($tutoras), SQL_PARAMS_NAMED);
        $params['alumno'] = $alumnoid;
        $params['tipo'] = \core_message\api::MESSAGE_CONVERSATION_TYPE_INDIVIDUAL;
        $ultima = $DB->get_record_sql(
            "SELECT otra.userid AS tutora, MAX(m.timecreated) AS ultima
               FROM {message_conversations} c
               JOIN {message_conversation_members} yo ON yo.conversationid = c.id AND yo.userid = :alumno
               JOIN {message_conversation_members} otra ON otra.conversationid = c.id AND otra.userid $insql
               JOIN {messages} m ON m.conversationid = c.id
              WHERE c.type = :tipo
           GROUP BY otra.userid
           ORDER BY ultima DESC", $params, IGNORE_MULTIPLE);
        if ($ultima && isset($tutoras[(int) $ultima->tutora])) {
            return $tutoras[(int) $ultima->tutora];
        }
        // 2. Repartidas de forma estable: el mismo alumno, la misma tutora.
        ksort($tutoras);
        $lista = array_values($tutoras);
        return $lista[$alumnoid % count($lista)];
    }

    /**
     * La conversación directa alumno ↔ tutora (la crea si no existe), anotada con su
     * curso para que el CRM sepa de qué curso es la consulta. Null si Moodle no deja
     * al alumno escribirle.
     */
    public static function conversacion(int $courseid, int $alumnoid, int $tutoraid): ?int {
        global $DB;
        if (!\core_message\api::can_send_message($tutoraid, $alumnoid)) {
            return null;
        }
        $id = \core_message\api::get_conversation_between_users([$alumnoid, $tutoraid]);
        if (!$id) {
            $c = \core_message\api::create_conversation(\core_message\api::MESSAGE_CONVERSATION_TYPE_INDIVIDUAL, [$alumnoid, $tutoraid]);
            $id = (int) $c->id;
        }
        $fila = $DB->get_record('local_crm_chat', ['conversationid' => $id]);
        if ($fila) {
            if ((int) $fila->courseid !== $courseid) {
                $DB->update_record('local_crm_chat', (object) ['id' => $fila->id, 'courseid' => $courseid, 'timemodified' => time()]);
            }
        } else {
            $DB->insert_record('local_crm_chat', (object) [
                'conversationid' => $id, 'courseid' => $courseid, 'alumnoid' => $alumnoid, 'tutoraid' => $tutoraid,
                'timemodified' => time(),
            ]);
        }
        return (int) $id;
    }

    /** El curso de una conversación, si se abrió desde el chat de un curso. */
    public static function curso_de(int $conversationid): ?int {
        global $DB;
        $c = $DB->get_field('local_crm_chat', 'courseid', ['conversationid' => $conversationid]);
        return $c ? (int) $c : null;
    }

    /**
     * El script que cambia «Entrar al chat» en la página de la actividad Chat: lleva a
     * chat.php (que elige la tutora) y quita «Usar interfaz más accesible», que abre la
     * misma sala. Sin expresiones regulares ni dependencias: funciona en cualquier tema.
     */
    public static function script_del_boton(): string {
        global $PAGE;
        if (!self::activo() || $PAGE->pagetype !== 'mod-chat-view' || !isloggedin() || isguestuser() || empty($PAGE->cm->id)) {
            return '';
        }
        $destino = json_encode((new \moodle_url('/local/crm/chat.php', ['id' => $PAGE->cm->id]))->out(false));
        return <<<HTML
<script>
(function () {
  function cambiar() {
    var zona = document.querySelector("#region-main") || document.body;
    Array.prototype.forEach.call(zona.querySelectorAll("a[href*='/mod/chat/gui_']"), function (a) {
      if ((a.getAttribute("href") || "").indexOf("gui_basic") >= 0) { a.remove(); return; }
      var n = a.cloneNode(true);
      n.removeAttribute("id");
      n.removeAttribute("target");
      n.setAttribute("href", {$destino});
      n.setAttribute("data-crm-chat", "directo");
      a.parentNode.replaceChild(n, a);
    });
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", cambiar); } else { cambiar(); }
})();
</script>
HTML;
    }
}
