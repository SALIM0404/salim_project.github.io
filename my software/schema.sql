-- ============================================================================
--  Intelligent Timetable Generation System — Relational Schema
--  Engine target: MySQL 8 / MariaDB 10.5+ (uses JSON + CHECK constraints).
--  For PostgreSQL, swap AUTO_INCREMENT -> GENERATED ALWAYS AS IDENTITY and
--  ENGINE=InnoDB line can be dropped.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS timetable_system;
USE timetable_system;

-- ----------------------------------------------------------------------------
-- 1. USERS  (login / access control)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    full_name       VARCHAR(120)        NOT NULL,
    username        VARCHAR(60)         NOT NULL UNIQUE,
    -- Store a salted hash (bcrypt/argon2) in production, never plain text.
    password_hash   VARCHAR(255)        NOT NULL,
    role            ENUM('admin','scheduler','viewer') NOT NULL DEFAULT 'viewer',
    is_active       TINYINT(1)          NOT NULL DEFAULT 1,
    created_at      TIMESTAMP           DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 2. DEPARTMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE departments (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    code            VARCHAR(10)         NOT NULL UNIQUE,
    name            VARCHAR(120)        NOT NULL,
    created_at      TIMESTAMP           DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 3. LECTURERS
-- ----------------------------------------------------------------------------
CREATE TABLE lecturers (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    staff_no        VARCHAR(20)         NOT NULL UNIQUE,
    full_name       VARCHAR(120)        NOT NULL,
    email           VARCHAR(150)        NOT NULL UNIQUE,
    department_id   INT                 NOT NULL,
    max_hours_week  SMALLINT UNSIGNED   NOT NULL DEFAULT 18,
    created_at      TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lecturer_department
        FOREIGN KEY (department_id) REFERENCES departments(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 4. CLASSROOMS
-- ----------------------------------------------------------------------------
CREATE TABLE classrooms (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(60)         NOT NULL UNIQUE,
    capacity        SMALLINT UNSIGNED   NOT NULL,
    room_type       ENUM('lecture_hall','lab','seminar_room') NOT NULL DEFAULT 'lecture_hall',
    created_at      TIMESTAMP           DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 5. COURSES
-- ----------------------------------------------------------------------------
CREATE TABLE courses (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    code                VARCHAR(20)      NOT NULL UNIQUE,
    name                VARCHAR(150)     NOT NULL,
    department_id       INT              NOT NULL,
    lecturer_id         INT              NULL,
    credit_hours        TINYINT UNSIGNED NOT NULL DEFAULT 3,
    sessions_per_week   TINYINT UNSIGNED NOT NULL DEFAULT 2,
    cohort_size         SMALLINT UNSIGNED NOT NULL DEFAULT 40,
    created_at          TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_course_department
        FOREIGN KEY (department_id) REFERENCES departments(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_course_lecturer
        FOREIGN KEY (lecturer_id) REFERENCES lecturers(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 6. TIME SLOTS
-- ----------------------------------------------------------------------------
CREATE TABLE time_slots (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    day_of_week     ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday') NOT NULL,
    start_time      TIME                NOT NULL,
    end_time        TIME                NOT NULL,
    label           VARCHAR(20)         GENERATED ALWAYS AS (
                        CONCAT(SUBSTRING(day_of_week,1,3),' ',
                               TIME_FORMAT(start_time,'%H:%i'))
                    ) STORED,
    CONSTRAINT uq_slot UNIQUE (day_of_week, start_time, end_time),
    CONSTRAINT chk_slot_time CHECK (end_time > start_time)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 7. TIMETABLE  (the generated / edited schedule — one row per placed session)
-- ----------------------------------------------------------------------------
CREATE TABLE timetable_entries (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    course_id       INT                 NOT NULL,
    lecturer_id     INT                 NOT NULL,
    classroom_id    INT                 NOT NULL,
    time_slot_id    INT                 NOT NULL,
    created_by      INT                 NULL,
    created_at      TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP           DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_tt_course    FOREIGN KEY (course_id)    REFERENCES courses(id)      ON DELETE CASCADE,
    CONSTRAINT fk_tt_lecturer  FOREIGN KEY (lecturer_id)  REFERENCES lecturers(id)    ON DELETE CASCADE,
    CONSTRAINT fk_tt_room      FOREIGN KEY (classroom_id) REFERENCES classrooms(id)   ON DELETE CASCADE,
    CONSTRAINT fk_tt_slot      FOREIGN KEY (time_slot_id) REFERENCES time_slots(id)   ON DELETE CASCADE,
    CONSTRAINT fk_tt_user      FOREIGN KEY (created_by)   REFERENCES users(id)        ON DELETE SET NULL,

    -- ---- HARD CLASH PREVENTION AT THE DATABASE LEVEL -----------------------
    -- A lecturer cannot teach two sessions in the same time slot.
    CONSTRAINT uq_lecturer_slot UNIQUE (lecturer_id, time_slot_id),
    -- A classroom cannot host two sessions in the same time slot.
    CONSTRAINT uq_room_slot     UNIQUE (classroom_id, time_slot_id)
) ENGINE=InnoDB;

-- Helpful indexes for fast lookups / search / reporting
CREATE INDEX idx_tt_course   ON timetable_entries(course_id);
CREATE INDEX idx_course_dept ON courses(department_id);
CREATE INDEX idx_lect_dept   ON lecturers(department_id);
CREATE INDEX idx_slot_day    ON time_slots(day_of_week);

-- ----------------------------------------------------------------------------
-- VIEW: a denormalised, human-readable timetable — used for "View / Search /
-- Print" screens so the app never has to join five tables at read time.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_timetable AS
SELECT
    te.id                AS entry_id,
    c.code                AS course_code,
    c.name                AS course_name,
    d.name                AS department,
    l.full_name           AS lecturer,
    r.name                AS classroom,
    ts.day_of_week        AS day,
    ts.start_time,
    ts.end_time
FROM timetable_entries te
JOIN courses     c  ON c.id  = te.course_id
JOIN departments d  ON d.id  = c.department_id
JOIN lecturers   l  ON l.id  = te.lecturer_id
JOIN classrooms  r  ON r.id  = te.classroom_id
JOIN time_slots  ts ON ts.id = te.time_slot_id;

-- ----------------------------------------------------------------------------
-- SEED DATA (minimal, matches the demo data used by the front-end mock DB)
-- ----------------------------------------------------------------------------
INSERT INTO users (full_name, username, password_hash, role) VALUES
('System Administrator', 'admin', '$2y$10$REPLACE_WITH_REAL_BCRYPT_HASH', 'admin');

INSERT INTO departments (code, name) VALUES
('CS','Computer Science'), ('EE','Electrical Engineering'),
('MA','Mathematics'), ('BA','Business Administration');

INSERT INTO time_slots (day_of_week, start_time, end_time) VALUES
('Monday','08:00','09:00'), ('Monday','09:00','10:00'), ('Monday','10:00','11:00'),
('Tuesday','08:00','09:00'), ('Tuesday','09:00','10:00'), ('Tuesday','10:00','11:00'),
('Wednesday','08:00','09:00'), ('Wednesday','09:00','10:00'), ('Wednesday','10:00','11:00'),
('Thursday','08:00','09:00'), ('Thursday','09:00','10:00'), ('Thursday','10:00','11:00'),
('Friday','08:00','09:00'), ('Friday','09:00','10:00'), ('Friday','10:00','11:00');

-- ============================================================================
-- NOTE ON CLASH PREVENTION
-- The UNIQUE constraints uq_lecturer_slot and uq_room_slot make it physically
-- impossible for the database to store two sessions with the same lecturer
-- (or the same room) at the same time slot — any INSERT/UPDATE that would
-- create a clash is rejected by MySQL itself, as a second line of defence
-- behind the application-level clash checker in app.js.
-- ============================================================================
