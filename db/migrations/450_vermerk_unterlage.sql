-- 450 Vermerk am Traktandum (AP-E8-4; UC-006 A2.2, A-74): Beim Versand festgehaltene Unterlagen merken sich, ob nur der
-- Quality-Check offen war; so bleibt nach dem Versand unterscheidbar, ob Unterlagen fehlen oder der Quality-Check offen
-- ist. Das Traktandum bleibt in beiden Fällen mit Vermerk stehen.
ALTER TABLE ppm.unterlage ADD COLUMN quality_check_offen boolean NOT NULL DEFAULT false;
