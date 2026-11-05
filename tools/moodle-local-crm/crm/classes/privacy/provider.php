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
namespace local_crm\privacy;

defined('MOODLE_INTERNAL') || die();

use core_privacy\local\metadata\collection;
use core_privacy\local\request\approved_contextlist;
use core_privacy\local\request\approved_userlist;
use core_privacy\local\request\contextlist;
use core_privacy\local\request\userlist;
use core_privacy\local\request\writer;

/**
 * Lo que el plugin guarda en Moodle: de qué curso es cada conversación del chat directo
 * (con el alumno y la tutora). Y lo que manda al CRM del centro: los mensajes privados.
 */
class provider implements
        \core_privacy\local\metadata\provider,
        \core_privacy\local\request\plugin\provider,
        \core_privacy\local\request\core_userlist_provider {

    public static function get_metadata(collection $coleccion): collection {
        $coleccion->add_database_table('local_crm_chat', [
            'conversationid' => 'privacy:metadata:chat:conversationid',
            'courseid'       => 'privacy:metadata:chat:courseid',
            'alumnoid'       => 'privacy:metadata:chat:alumnoid',
            'tutoraid'       => 'privacy:metadata:chat:tutoraid',
        ], 'privacy:metadata:chat');
        $coleccion->add_external_location_link('crm', [
            'userid'   => 'privacy:metadata:crm:userid',
            'fullname' => 'privacy:metadata:crm:fullname',
            'email'    => 'privacy:metadata:crm:email',
            'message'  => 'privacy:metadata:crm:message',
        ], 'privacy:metadata:crm');
        return $coleccion;
    }

    /** Las filas son del sistema: el contexto es el del sitio. */
    public static function get_contexts_for_userid(int $userid): contextlist {
        $lista = new contextlist();
        $lista->add_from_sql('SELECT ctx.id FROM {context} ctx WHERE ctx.contextlevel = :nivel AND EXISTS (
            SELECT 1 FROM {local_crm_chat} c WHERE c.alumnoid = :a OR c.tutoraid = :t)',
            ['nivel' => CONTEXT_SYSTEM, 'a' => $userid, 't' => $userid]);
        return $lista;
    }

    public static function get_users_in_context(userlist $userlist) {
        if (!$userlist->get_context() instanceof \context_system) {
            return;
        }
        $userlist->add_from_sql('alumnoid', 'SELECT alumnoid FROM {local_crm_chat}', []);
        $userlist->add_from_sql('tutoraid', 'SELECT tutoraid FROM {local_crm_chat}', []);
    }

    public static function export_user_data(approved_contextlist $contextlist) {
        global $DB;
        $userid = (int) $contextlist->get_user()->id;
        foreach ($contextlist->get_contexts() as $contexto) {
            if (!$contexto instanceof \context_system) {
                continue;
            }
            $filas = $DB->get_records_select('local_crm_chat', 'alumnoid = ? OR tutoraid = ?', [$userid, $userid],
                '', 'id, conversationid, courseid, alumnoid, tutoraid, timemodified');
            if ($filas) {
                writer::with_context($contexto)->export_data([get_string('pluginname', 'local_crm')],
                    (object) ['chat_directo' => array_values($filas)]);
            }
        }
    }

    public static function delete_data_for_all_users_in_context(\context $contexto) {
        global $DB;
        if ($contexto instanceof \context_system) {
            $DB->delete_records('local_crm_chat');
        }
    }

    public static function delete_data_for_user(approved_contextlist $contextlist) {
        global $DB;
        $userid = (int) $contextlist->get_user()->id;
        foreach ($contextlist->get_contexts() as $contexto) {
            if ($contexto instanceof \context_system) {
                $DB->delete_records_select('local_crm_chat', 'alumnoid = ? OR tutoraid = ?', [$userid, $userid]);
            }
        }
    }

    public static function delete_data_for_users(approved_userlist $userlist) {
        global $DB;
        if (!$userlist->get_context() instanceof \context_system || !$userlist->get_userids()) {
            return;
        }
        [$sql1, $p1] = $DB->get_in_or_equal($userlist->get_userids(), SQL_PARAMS_NAMED, 'a');
        [$sql2, $p2] = $DB->get_in_or_equal($userlist->get_userids(), SQL_PARAMS_NAMED, 't');
        $DB->delete_records_select('local_crm_chat', "alumnoid $sql1 OR tutoraid $sql2", $p1 + $p2);
    }
}
