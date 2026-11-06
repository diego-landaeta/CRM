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
 * El mensaje no se manda al CRM aquí: se encola. Así el alumno no espera a que el
 * CRM conteste al enviar su mensaje, y si el CRM está caído la tarea se reintenta
 * sola (las tareas ad hoc de Moodle se reintentan con espera creciente).
 */
class observer {
    public static function mensaje_enviado(\core\event\message_sent $evento): void {
        if (!aviso::configurado()) {
            return;
        }
        $tarea = new task\avisar_crm();
        $tarea->set_custom_data(['mensajeid' => (int) $evento->objectid]);
        \core\task\manager::queue_adhoc_task($tarea);
    }
}
