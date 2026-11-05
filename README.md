# Lernmodul-Tool – OSZ Rapperswil

Erste technische Ausbaustufe der Lernmodul-Verwaltung, mit Supabase Auth und geschützter Datenbank.

## Stand
- Öffentlicher Modulkatalog (nur offene Ausschreibungen)
- Erstregistrierung und Anmeldung der freigegebenen Administrator-E-Mail
- Entwürfe von Ausschreibungen, Module, einfacher CSV-Schülerimport
- Layout gestalterisch an das Oberstufenzentrum angelehnt; keine offizielle Schulwebsite und keine bestätigte exakte Corporate-Design-Übernahme.

## Noch nicht für produktive Schülerdaten freigegeben
Persönliche Schülercodes, Schüleranmeldung, Zuteilungsoptimierung, Zeitblockkonflikte, robuste CSV-Validierung, Exporte und vollständige Tests fehlen noch. Keine echten Schülerdaten importieren.

## Inbetriebnahme
1. GitHub Pages für Branch main und Verzeichnis / (root) aktivieren.
2. In Supabase > Authentication > URL Configuration die Pages-URL als Site URL und Redirect URL konfigurieren.
3. Unter der freigegebenen Adresse lia.lehmann@bluewin.ch registrieren und E-Mail bestätigen.
4. Login und Datenbankrechte mit Testdaten prüfen.

Die im Browser enthaltene Supabase-Publishable-Key ist öffentlich verwendbar. Niemals Service-Role-Keys, Passwörter oder Schülerdaten in dieses Repository schreiben.

Projekt: https://supabase.com/dashboard/project/htqcyvhzrtrmtlqqdzly
