-- Effective-dated schedule metadata. Existing rows remain valid historical rows.
ALTER TABLE WorkSchedule ADD COLUMN scheduleGroupId TEXT NOT NULL DEFAULT '';
ALTER TABLE WorkSchedule ADD COLUMN effectiveFrom TEXT NOT NULL DEFAULT '2000-01-01';
ALTER TABLE WorkSchedule ADD COLUMN effectiveTo TEXT;
UPDATE WorkSchedule SET scheduleGroupId = id WHERE scheduleGroupId = '';

ALTER TABLE FacultySchedule ADD COLUMN scheduleGroupId TEXT NOT NULL DEFAULT '';
ALTER TABLE FacultySchedule ADD COLUMN effectiveFrom TEXT NOT NULL DEFAULT '2000-01-01';
ALTER TABLE FacultySchedule ADD COLUMN effectiveTo TEXT;
UPDATE FacultySchedule SET scheduleGroupId = id WHERE scheduleGroupId = '';

DROP INDEX IF EXISTS WorkSchedule_employeeId_dayOfWeek_key;
DROP INDEX IF EXISTS WorkSchedule_dayOfWeek_isActive_idx;
DROP INDEX IF EXISTS FacultySchedule_employeeId_dayOfWeek_isActive_idx;
DROP INDEX IF EXISTS FacultySchedule_dayOfWeek_isActive_idx;

CREATE INDEX WorkSchedule_employeeId_effectiveFrom_effectiveTo_isActive_idx
ON WorkSchedule(employeeId, effectiveFrom, effectiveTo, isActive);
CREATE INDEX WorkSchedule_dayOfWeek_effectiveFrom_effectiveTo_isActive_idx
ON WorkSchedule(dayOfWeek, effectiveFrom, effectiveTo, isActive);
CREATE INDEX WorkSchedule_scheduleGroupId_idx ON WorkSchedule(scheduleGroupId);

CREATE INDEX FacultySchedule_employeeId_effectiveFrom_effectiveTo_isActive_idx
ON FacultySchedule(employeeId, effectiveFrom, effectiveTo, isActive);
CREATE INDEX FacultySchedule_dayOfWeek_effectiveFrom_effectiveTo_isActive_idx
ON FacultySchedule(dayOfWeek, effectiveFrom, effectiveTo, isActive);
CREATE INDEX FacultySchedule_scheduleGroupId_idx ON FacultySchedule(scheduleGroupId);

ALTER TABLE AttendanceRecord ADD COLUMN renderedMinutes INTEGER NOT NULL DEFAULT 0;
UPDATE AttendanceRecord
SET renderedMinutes = CASE
  WHEN timeIn IS NULL OR timeOut IS NULL THEN 0
  ELSE MAX(
    0,
    (CAST(substr(timeOut, 1, 2) AS INTEGER) * 60 + CAST(substr(timeOut, 4, 2) AS INTEGER))
    - (CAST(substr(timeIn, 1, 2) AS INTEGER) * 60 + CAST(substr(timeIn, 4, 2) AS INTEGER))
  )
END;

UPDATE SystemSetting
SET value = '15', description = 'Fixed grace period before late minutes are counted.'
WHERE key = 'lateGraceMinutes';
