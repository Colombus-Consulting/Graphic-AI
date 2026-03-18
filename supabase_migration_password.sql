-- Migration: Ajout du flag must_change_password pour forcer le changement au premier login
-- À exécuter dans Supabase SQL Editor

ALTER TABLE public.profiles
ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Mettre à jour les politiques RLS pour inclure le nouveau champ
-- (pas nécessaire car les politiques existantes utilisent auth.uid() et non des colonnes spécifiques)
