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
 * Al actualizar el plugin en un campus ya conectado, el usuario del servicio recibe los
 * permisos nuevos (p. ej. ver el curso completo en la 1.5.0) sin tener que reconectar.
 *
 * @package    local_crm
 * @copyright  2026 ISEIE Innovation School
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Pasos de actualización de local_crm.
 *
 * @param int $oldversion La versión instalada antes.
 * @return bool
 */
function xmldb_local_crm_upgrade($oldversion) {
    global $DB;
    if ($oldversion < 2026110511) {
        // Solo si ya existe el usuario del servicio (el campus se conectó con la 1.4.0 o después).
        if ($DB->record_exists('user', ['username' => \local_crm\conexion::USUARIO_SERVICIO, 'deleted' => 0])) {
            \local_crm\conexion::usuario_servicio();
        }
        upgrade_plugin_savepoint(true, 2026110511, 'local', 'crm');
    }
    if ($oldversion < 2026110512) {
        $dbman = $DB->get_manager();
        $tabla = new xmldb_table('local_crm_chat');
        if (!$dbman->table_exists($tabla)) {
            $tabla->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
            $tabla->add_field('conversationid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
            $tabla->add_field('courseid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
            $tabla->add_field('alumnoid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
            $tabla->add_field('tutoraid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
            $tabla->add_field('timemodified', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $tabla->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);
            $tabla->add_index('conversationid', XMLDB_INDEX_UNIQUE, ['conversationid']);
            $tabla->add_index('courseid', XMLDB_INDEX_NOTUNIQUE, ['courseid']);
            $dbman->create_table($tabla);
        }
        upgrade_plugin_savepoint(true, 2026110512, 'local', 'crm');
    }
    return true;
}
