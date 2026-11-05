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

namespace local_crm\external;

defined('MOODLE_INTERNAL') || die();

use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_single_structure;
use core_external\external_value;

/**
 * Contestar desde el CRM como la tutora, sin el token personal de cada una.
 *
 * Lo llama el CRM con el token de su servicio («CRM»), cuyo usuario tiene
 * `local/crm:enviarcomo`. Solo puede enviar como alguien que es personal del
 * campus (tutor, profesor, gestor o administrador): nunca como un alumno.
 * El mensaje va por la conversación privada de los dos (se abre si no existía),
 * así que el alumno lo ve en el mismo hilo que el resto.
 */
class enviar_mensaje extends external_api {
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'desde' => new external_value(PARAM_INT, 'Id de Moodle de la tutora que firma el mensaje'),
            'para'  => new external_value(PARAM_INT, 'Id de Moodle del destinatario'),
            'texto' => new external_value(PARAM_RAW, 'El mensaje, en HTML'),
        ]);
    }

    public static function execute(int $desde, int $para, string $texto): array {
        $p = self::validate_parameters(self::execute_parameters(), ['desde' => $desde, 'para' => $para, 'texto' => $texto]);
        $contexto = \context_system::instance();
        self::validate_context($contexto);
        require_capability('local/crm:enviarcomo', $contexto);

        foreach ([$p['desde'], $p['para']] as $id) {
            $u = \core_user::get_user($id, 'id, deleted, suspended');
            if (!$u || $u->deleted || $u->suspended) {
                throw new \invalid_parameter_exception('Usuario no válido: ' . $id);
            }
        }
        if ($p['desde'] === $p['para']) {
            throw new \invalid_parameter_exception('No se puede enviar un mensaje a uno mismo.');
        }
        if (!\local_crm\aviso::es_personal($p['desde'])) {
            throw new \invalid_parameter_exception('Solo se puede enviar como personal del campus.');
        }
        if (trim(strip_tags($p['texto'])) === '') {
            throw new \invalid_parameter_exception('El mensaje está vacío.');
        }

        $conversacion = \core_message\api::get_conversation_between_users([$p['desde'], $p['para']]);
        if (!$conversacion) {
            $conversacion = \core_message\api::create_conversation(
                \core_message\api::MESSAGE_CONVERSATION_TYPE_INDIVIDUAL, [$p['desde'], $p['para']])->id;
        }
        $mensaje = \core_message\api::send_message_to_conversation($p['desde'], $conversacion, $p['texto'], FORMAT_HTML);
        return ['id' => (int) $mensaje->id, 'conversacion_id' => (int) $conversacion];
    }

    public static function execute_returns(): external_single_structure {
        return new external_single_structure([
            'id'              => new external_value(PARAM_INT, 'Id del mensaje en Moodle'),
            'conversacion_id' => new external_value(PARAM_INT, 'Id de la conversación'),
        ]);
    }
}
