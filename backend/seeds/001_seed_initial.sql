-- ============================================================
-- CRM MultiProyecto — Seed inicial
-- Ejecutar despues de 001_initial_schema.sql
-- password_hash = bcrypt('CrmTemp2026!', cost=12)
-- Los usuarios deben cambiar su contrasena en el primer login
-- ============================================================

BEGIN;

-- ============================================================
-- USUARIOS
-- ============================================================

-- password: CrmTemp2026! (bcrypt cost 12)
INSERT INTO users (nombre, email, password_hash, role) VALUES
  ('Manuel Casas', 'manuel@empresa.com', '$2b$12$LJ3m5Gq8z5Kv0mQpJx0eVOzR1vKpW5tY6nH3cX9bA2dF8gE4iO6Wy', 'superadmin'),
  ('Diego R.',     'diego@empresa.com',  '$2b$12$LJ3m5Gq8z5Kv0mQpJx0eVOzR1vKpW5tY6nH3cX9bA2dF8gE4iO6Wy', 'admin'),
  ('Angel M.',     'angel@empresa.com',  '$2b$12$LJ3m5Gq8z5Kv0mQpJx0eVOzR1vKpW5tY6nH3cX9bA2dF8gE4iO6Wy', 'admin');

-- ============================================================
-- PROYECTOS
-- ============================================================

INSERT INTO projects (nombre, slug, type, emoji, webhook_api_key) VALUES
  ('Psiko Aprende',    'psiko-aprende',    'crm', '🧠', 'whk_psiko_' || gen_random_uuid()),
  ('ISEIH',            'iseih',            'crm', '🎓', 'whk_iseih_' || gen_random_uuid()),
  ('Fono Aprende',     'fono-aprende',     'crm', '🗣️', 'whk_fono_' || gen_random_uuid()),
  ('Psicologo IA',     'psicologo-ia',     'ia',  '🤖', 'whk_psicoia_' || gen_random_uuid()),
  ('Nutricionista IA', 'nutricionista-ia', 'ia',  '🥗', 'whk_nutria_' || gen_random_uuid()),
  ('Tarot IA',         'tarot-ia',         'ia',  '🔮', 'whk_tarotia_' || gen_random_uuid());

-- ============================================================
-- ASIGNACION USUARIOS A PROYECTOS
-- ============================================================

-- Manuel (superadmin) tiene acceso a todos
INSERT INTO user_projects (user_id, project_id, orden_cola)
SELECT 1, id, 0 FROM projects;

-- Diego: Psiko Aprende, ISEIH
INSERT INTO user_projects (user_id, project_id, orden_cola) VALUES
  (2, 1, 1),
  (2, 2, 1);

-- Angel: Psiko Aprende, Fono Aprende
INSERT INTO user_projects (user_id, project_id, orden_cola) VALUES
  (3, 1, 2),
  (3, 3, 1);

-- ============================================================
-- PRODUCTOS INICIALES
-- ============================================================

-- Psiko Aprende
INSERT INTO products (project_id, nombre, descripcion) VALUES
  (1, 'Curso Psicologia Infantil', 'Formacion intensiva en psicologia infantil y adolescente — 6 meses'),
  (1, 'Master Neuroeducacion', 'Master oficial en neuroeducacion aplicada — 12 meses'),
  (1, 'Taller Mindfulness Educativo', 'Taller practico de mindfulness para docentes — 3 meses');

-- ISEIH
INSERT INTO products (project_id, nombre, descripcion) VALUES
  (2, 'Grado Superior Educacion Infantil', 'Ciclo formativo oficial de 2 anos'),
  (2, 'Curso Atencion Temprana', 'Especializacion en atencion temprana 0-6 anos');

-- Fono Aprende
INSERT INTO products (project_id, nombre, descripcion) VALUES
  (3, 'Taller Logopedia Infantil', 'Taller practico de logopedia para ninos'),
  (3, 'Curso Dislexia y Lectoescritura', 'Intervencion en dificultades de lectoescritura'),
  (3, 'Master Terapia Miofuncional', 'Master en terapia miofuncional orofacial');

-- Psicologo IA
INSERT INTO products (project_id, nombre, descripcion) VALUES
  (4, 'Plan Basico', 'Acceso a chatbot IA con 50 consultas/mes'),
  (4, 'Plan Premium', 'Consultas ilimitadas + seguimiento semanal');

-- Nutricionista IA
INSERT INTO products (project_id, nombre, descripcion) VALUES
  (5, 'Plan Mensual', 'Plan nutricional personalizado por IA');

-- Tarot IA
INSERT INTO products (project_id, nombre, descripcion) VALUES
  (6, 'Lectura Completa', 'Lectura de tarot completa con IA');

-- ============================================================
-- ESTADO COLA ROUND-ROBIN (inicializar para proyectos CRM)
-- ============================================================

INSERT INTO project_queue_state (project_id, last_assigned_index)
SELECT id, 0 FROM projects WHERE type = 'crm';

COMMIT;
