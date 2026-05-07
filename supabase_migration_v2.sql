-- Migration V2: Add mode column to projects table
-- Run this BEFORE deploying the new code

ALTER TABLE projects ADD COLUMN mode TEXT NOT NULL DEFAULT 'redesign';

-- Existing projects automatically get 'redesign' via DEFAULT.
-- The api_usage table already has a TEXT mode column — 'create' works directly.
