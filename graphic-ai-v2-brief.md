# Graphic AI — Brief V2

## Contexte

Graphic AI est une application web interne de Colombus Consulting permettant de redesigner des graphiques via l'IA générative (Gemini). L'outil est en production depuis 1 mois.

**Stack actuelle :** Node.js / Express sur Railway, Supabase (PostgreSQL + auth + storage), API Google Gemini.

**URL prod :** https://graphic-ai-production.up.railway.app/

## Retours utilisateurs — ce qui motive la V2

Les premiers utilisateurs sont très satisfaits et ont détourné l'outil au-delà de son périmètre initial. Ils l'utilisent pour générer des schémas pour des présentations PowerPoint, des dessins, des illustrations — pas uniquement des graphiques de données. L'outil doit évoluer pour embrasser ces nouveaux cas d'usage.

## Vision V2

Passer d'une app mono-usage (redesign de graphiques) à une app multi-outils avec deux modes distincts, chacun sur sa propre page.

### Page 1 — "Redesign" (évolution de l'existant)

- **Principe :** Image en entrée → image améliorée en sortie.
- **C'est la page actuelle**, qui fonctionne déjà bien.
- Couvre aussi les cas de déclinaison (changer de style, adapter un format, passer en dark mode, etc.) — pas besoin d'un mode dédié pour ça.
- Le prompt système Gemini reste orienté fidélité des données pour les graphiques, mais doit être assez souple pour accepter des schémas, illustrations, etc. en entrée.

### Page 2 — "Générer" (nouveau)

- **Principe :** Texte en entrée (prompt uniquement, pas d'image source) → image créée from scratch en sortie.
- L'utilisateur décrit ce qu'il veut en langage naturel et l'IA génère le visuel.
- **Exemples de cas d'usage :**
  - "Un schéma en 3 étapes du parcours de transformation digitale, style flat corporate bleu"
  - "Une illustration minimaliste représentant la collaboration homme-machine"
  - "Un organigramme de la gouvernance projet avec 4 niveaux"
- Le prompt système Gemini est complètement différent du mode Redesign : pas de contrainte d'intégrité de données, plus de latitude créative.
- L'utilisateur peut toujours ajouter des images d'inspiration pour guider le style.
- Mêmes options que le mode Redesign : nombre de variantes (1-4), format/ratio, résolution.

## UX clé : exemples showcase sur chaque page

Chaque page doit présenter un ou plusieurs exemples concrets montrant ce que l'outil est capable de produire sur cette page. L'objectif est de provoquer un "wow effect" immédiat pour que les utilisateurs aient envie d'essayer avec leurs propres cas d'usage.

- **Page Redesign :** Montrer un avant/après (ex : graphique Excel basique → version redesignée aux couleurs Colombus).
- **Page Générer :** Montrer le prompt utilisé + le résultat obtenu. Idéalement 2-3 exemples variés (schéma processus, illustration conceptuelle, infographie).

Ces exemples doivent être visibles en permanence sur la page (section dédiée ou carrousel), pas cachés derrière un clic.

## Ce qui est hors scope V2

- **Templates / presets de charte partagés** : bonne idée mais complexe, à faire dans un second temps.
- **Mode "Décliner" dédié** : pas nécessaire, le mode Redesign couvre ce besoin.

## Points d'attention techniques

- **Deux flows backend distincts** pour Redesign et Générer (prompts système Gemini différents, le mode Générer n'envoie pas d'image source).
- **Navigation** : passer d'une app single-page à une app multi-pages avec un menu/onglets clair entre les modes.

- **Le dashboard admin et le suivi des coûts doivent couvrir les deux modes** (distinguer les coûts Redesign vs Générer serait un plus).
