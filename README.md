# Lernmodul-Tool – Oberstufenzentrum Rapperswil

**Testversion** der Verwaltung von Lernmodulen für Schülerinnen und Schüler. Weboberfläche auf GitHub Pages; Daten, Zugriffsrechte und serverseitige Berechnung auf einem **eigenen Supabase-Projekt**. Andere Tools und Datenbanken bleiben getrennt.

## Geführte Verwaltung (neues Bedienkonzept)

Die Administration ist nun als **Akkordeon mit acht Schritten** aufgebaut:

1. Ausschreibung anlegen
2. Module und Zeitblöcke erfassen
3. Schüler importieren
4. Persönliche Zugangscodes erzeugen
5. Teilnehmende einzeln oder nach Klasse auswählen
6. Anmeldung freigeben
7. Anmeldungen kontrollieren und bei Bedarf korrigieren
8. Zuteilung und Resultate verwalten

Nach einem erfolgreichen Schritt wird der nächste passende Abschnitt geöffnet, der vorherige eingeklappt. Bei den Modulen erfolgt dieser Wechsel erst, wenn mindestens so viele aktive Module vorhanden sind wie Wünsche verlangt werden. Jede Stufe lässt sich jederzeit über die Überschrift oder die Schaltflächen manuell öffnen, schliessen und erneut bearbeiten. Die Schaltfläche **Nächsten sinnvollen Schritt anzeigen** orientiert sich am Status der zuletzt erstellten Ausschreibung. Es werden keine Daten automatisch veröffentlicht oder zugeteilt: Dafür bleibt immer ein bewusster Admin-Klick erforderlich.

## Aktuelle Funktionen

- Administratoranmeldung über Supabase Auth, E-Mail-Bestätigung und schulinterne Freigabe
- Mehrere Ausschreibungen mit Start-/Endzeit, Anzahl Modulen pro Schüler und Wunschanzahl
- Module mit Mindest- und Höchstteilnehmerzahl und optionalen Zeitblöcken
- CSV-Import der Schülerstammdaten; eindeutige Schüler-IDs
- Sichere, zufällige persönliche Zugangscodes; nur Hash gespeichert; Ausgabe als CSV
- Schüleranmeldung mit priorisierten Modulwünschen, ohne öffentliche Einsicht in Schülerdaten
- Anmeldestand (wer hat Wünsche abgegeben, wer fehlt), CSV-Export und kontrollierte Nachmeldung/Korrektur durch die Schulverwaltung
- Schliessen der Anmeldephase, automatischer Zuteilungsvorschlag, manuelle Anpassungen und Sperren
- Serverseitige Prüfung vor Speicherung: Schüler, Module, Höchst-/Mindestplätze, Modulanzahl und Zeitüberschneidungen
- Ergebnisvorschau, CSV-Export, kontrollierte Veröffentlichung und persönliche Ergebnisabfrage mit Zugangscode
- Änderungsprotokoll für Zuteilungsentwürfe, Veröffentlichungen, Nachmeldungen und Sperren

**Zuteilungsalgorithmus:** gewichteter Min-Cost-Max-Flow für bevorzugte Module, bevorzugt vollständige erste Plätze vor weiteren Plätzen, wiederholbarer Losentscheid anhand eines gespeicherten Seeds. Mindestteilnehmerzahlen werden durch iteratives Ausschliessen unterfüllter Module berücksichtigt (heuristisch, keine Garantie einer mathematisch global optimalen Lösung). Überlappende Zeitblöcke werden aus Sicherheitsgründen gegebenenfalls konservativ gruppiert.

Quellcode des Edge-Dienstes: `supabase/functions/calculate-allocation/`. Der Algorithmus ist zur besseren Prüfung auch unter `allocation-algorithm.js` abgelegt. Änderungen an den beiden Kopien müssen synchron erfolgen.

## URL und Login

Webseite: https://rogerlehmann86-tech.github.io/Lernmodul-Tool/

Supabase-Projekt: https://supabase.com/dashboard/project/htqcyvhzrtrmtlqqdzly

Die URL ist in Supabase **Authentication → URL Configuration** als Site URL und Redirect URL eingetragen. Die erste Administratoradresse ist serverseitig hinterlegt; jede weitere Registrierung erhält ohne Freigabe keine Verwaltungsrechte.

## Vollständiger Ablauf mit Testdaten

1. In der Website als Administrator anmelden.
2. Unter **Ausschreibungen** einen Entwurf erstellen (z. B. eine Stunde offen, 1 Modul pro Schüler, 3 Wünsche).
3. Unter **Module** mindestens 3 Module anlegen; bei Bedarf zuerst Zeitblöcke erfassen.
4. Unter **Schüler** die Datei `samples/test-schueler.csv` importieren (vier erfundene Schüler).
5. **Fehlende Zugangscodes erzeugen** und die heruntergeladene CSV sicher aufbewahren. Codes können nicht nochmals im Klartext abgerufen werden.
6. **Alle aktiven Schüler zulassen** und **Ausschreibung freigeben**.
7. In einem privaten Browserfenster Schüler-ID und Code eines Testschülers eingeben, Modulwünsche auswählen, absenden. Bei Bedarf für weitere Testschüler wiederholen.
8. Unter **Schüler** den Anmeldestand prüfen. Fehlende Anmeldungen können über die Verwaltungsfunktion ergänzt werden.
9. Im Tab **Zuteilung** die Anmeldung schliessen, Berechnung starten, Resultate und Plätze kontrollieren.
10. Entwurf bei Bedarf manuell ändern, sperren, speichern, als CSV exportieren.
11. **Endresultate veröffentlichen**. Erst danach sieht ein Testschüler seine persönliche Zuteilung über Schüler-ID und Code.
12. Nach Abschluss des Tests die fiktiven Testdaten über den Administrationsweg entfernen. Testdatensätze nicht mit echten Datensätzen vermischen.

## CSV-Format

Zum Beispiel `external_id;first_name;last_name;class`. Deutsche Überschriften wie `Schüler-ID;Vorname;Nachname;Klasse` sowie Komma, Semikolon und Tabulator als Trennzeichen sind grundsätzlich vorgesehen. `.xlsx` zuerst als CSV UTF-8 exportieren.

## Sicherheits- und Betriebsgrenzen

- GitHub-Repository und GitHub-Pages-Website sind öffentlich. Nur Programmdateien veröffentlichen. **Keine** Schülertabellen, Zugangscodes, Passwortdateien oder geheime Supabase-Schlüssel hochladen.
- Die öffentliche Supabase-Publishable-Key ist bewusst im Browser hinterlegt. Geheimschlüssel gehören ausschliesslich auf den Server.
- SQL-RLS und administrative Serverfunktionen schützen Daten und Freigaben.
- Beim letzten Sicherheitscheck meldete Supabase **Leaked Password Protection Disabled**. Vor echtem Betrieb aktivieren: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Vor Produktiveinsatz: Tests im realen Browser einschliesslich Edge Function, Datenschutzfreigabe für Minderjährige, Aufbewahrungsfristen, Löschverfahren, Schutz vor automatisierten Codeversuchen/Rate-Limits, E-Mail-Absender und Zugangsverwaltung prüfen.
- Ein automatisierter End-to-End-Test der veröffentlichten Website wurde noch **nicht** durchgeführt. Serverfunktionen und das Zuteilungsverfahren wurden mit synthetischen Daten getestet; Datenbanktests liefen mit `ROLLBACK` und hinterliessen keine Schülerdaten.

## Gestaltung

Layout ist derzeit an das Oberstufenzentrum Rapperswil angelehnt. Das offizielle Schullogo und die exakten Corporate-Design-Farbwerte wurden noch nicht aus autorisierten Gestaltungsdateien übernommen.

## Weitere mögliche Ausbaustufen

- Druckfertige persönliche Zugangskarten, feinere Rechte für mehrere Schulmitarbeitende
- Nachvollziehbare Vergleichsvarianten der Zuteilung, automatische Konflikt-/Mindestteilnehmerprüfung mit garantierter Optimalität unter zusätzlichen Nebenbedingungen
- Klare Lösch- und Archivierungsprozesse sowie automatische Testprotokolle
