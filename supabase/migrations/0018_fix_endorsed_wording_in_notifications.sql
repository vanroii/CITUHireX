-- ============================================================================
-- CITUHireX — Migration 0018
-- Data fix: notification rows created before migration 0016 still have
-- "endorsed" wording baked into their stored title/body text (the old
-- trigger generated it; new notifications already say "approved"). Existing
-- rows don't get regenerated automatically since notifications are static
-- text, not computed at read time — so this is a one-time data correction.
-- ============================================================================

update notifications
set title = replace(replace(title, 'was endorsed', 'was approved'), 'Endorsed', 'Approved')
where title ilike '%endorsed%';

update notifications
set body = replace(replace(body, 'was endorsed', 'was approved'), 'Endorsed', 'Approved')
where body ilike '%endorsed%';
