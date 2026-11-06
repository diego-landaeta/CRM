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
 * «Entrar al chat»: lleva al alumno a su conversación directa con una tutora del curso,
 * y a la tutora, a su mensajería (donde están las de todos sus alumnos).
 *
 * @package    local_crm
 * @copyright  2026 ISEIE Innovation School
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../config.php');

$cmid = required_param('id', PARAM_INT);
$cm = get_coursemodule_from_id('chat', $cmid, 0, false, MUST_EXIST);
$curso = get_course($cm->course);
require_login($curso, false, $cm);
$contexto = context_course::instance($curso->id);
$sala = new moodle_url('/mod/chat/view.php', ['id' => $cm->id]);

if (!\local_crm\chat_directo::activo()) {
    redirect($sala);
}
// La tutora (o quien da clase en el curso): a su mensajería.
if (\local_crm\chat_directo::es_tutora($contexto, (int) $USER->id) || has_capability('moodle/course:update', $contexto)) {
    redirect(new moodle_url('/message/index.php'));
}
$tutora = \local_crm\chat_directo::elegir($contexto, (int) $USER->id);
$conv = $tutora ? \local_crm\chat_directo::conversacion((int) $curso->id, (int) $USER->id, (int) $tutora->id) : null;
if (!$conv) {
    // Sin tutora disponible (o Moodle no deja escribirle): se dice, en vez de abrir una sala vacía.
    redirect($sala, get_string('chat_sin_tutora', 'local_crm'), null, \core\output\notification::NOTIFY_WARNING);
}
redirect(new moodle_url('/message/index.php', ['convid' => $conv]));
