# Lernmodul-Tool – Oberstufenzentrum Rapperswil

**Testversion** der Verwaltung von Lernmodulen für Schülerinnen und Schüler. Weboberfläche auf GitHub Pages; Daten, Zugriffsrechte und serverseitige Berechnung auf einem **eigenen Supabase-Projekt**. Andere Tools und Datenbanken bleiben getrennt.

## Getrennte Schüler- und Administratoransicht

- Ohne Admin-Anmeldung erscheint ausschliesslich die Schüleransicht mit Modulkatalog, Wunschabgabe und persönlichem Ergebnisabruf.
- Über **Administration** im Kopfbereich öffnet sich das gesonderte Anmeldeformular.
- Nach erfolgreicher Prüfung des Administratorkontos wird ausschliesslich die geführte Verwaltung angezeigt. Die drei öffentlichen Schülerbereiche stehen nicht mehr darüber.
- Ein Administrator kann über **Schüleransicht** die öffentliche Ansicht kontrollieren und mit **Zur Verwaltung** zurückwechseln, ohne sich abmelden zu müssen.
- Der Ansichtswechsel ist eine reine Darstellungssache. Die Datenbankrechte werden weiterhin ausschliesslich durch Authentifizierung und Row Level Security gesteuert.
- Für einen direkten Link zum Administrator-Login kann die Adresse mit `?ansicht=admin` verwendet werden; ein bereits angemeldeter Administrator kommt standardmässig sofort in die Verwaltung.

## Administratorbereich: Ausschreibungen zuerst auswählen

Die bisherige Vierfach-Navigation wurde durch eine schlanke Kopfzeile mit dem Button **Ausschreibungen** ersetzt. Nach dem Login wird zunächst eine Liste aller Ausschreibungen mit **deutschen Statusbezeichnungen** angezeigt:

- `draft` → **Entwurf**
- `open` → **Anmeldung offen**
- `closed` → **Anmeldung geschlossen**
- `allocated` → **Zuteilung in Prüfung**
- `published` → **Ergebnisse veröffentlicht**
- `archived` → **Archiviert**

Diese technischen Statuswerte bleiben in Supabase absichtlich unverändert, damit der bestehende Workflow funktioniert.

Durch Anklicken einer Ausschreibung öffnet sich **nur deren** geführte Verwaltung, bestehend aus acht einzeln auf- und zuklappbaren Bereichen:

1. Ausschreibung (bei Entwürfen bearbeiten oder löschen)
2. Module und Zeitblöcke (Module hinzufügen, bearbeiten, löschen)
3. Schüler importieren
4. Persönliche Zugangscodes
5. Teilnehmende auswählen
6. Anmeldung freigeben
7. Anmeldungen kontrollieren
8. Zuteilungen und Ergebnisse

**Löschschutz:** Ganze Ausschreibungen lassen sich nur im Status **Entwurf** löschen. Module dürfen in Entwürfen entfernt werden; in offenen Ausschreibungen nur, solange noch keine Anmeldungen existieren und nach dem Löschen weiterhin genügend Module für die geforderte Zahl an Wünschen angeboten werden. Bei laufenden Anmeldungen und abgeschlossenen Zuteilungen sind Moduländerungen gesperrt. Das Löschen eines Entwurfs erfordert zusätzlich die Bestätigung seines Namens. Die Änderung wird serverseitig geprüft und protokolliert.

Die Schaltfläche **Ausschreibungen** kehrt jederzeit zur Liste zurück. Der Button **Neue Ausschreibung** startet einen neuen Entwurf. Das System setzt für alle Unterbereiche eine gemeinsame Ausschreibungs-Auswahl und vermeidet das Vermischen verschiedener Ausschreibungen.

Die eingebauten Formulare behalten ihre bisherigen Funktionen. Sie werden nur in die passenden Schritte verschoben. Erfolgreiche Speicheraktionen führen weiterhin zum nächsten Schritt; jeder Bereich lässt sich jederzeit manuell öffnen. Es wird nichts automatisch veröffentlicht oder zugeteilt.

## Zentrale Schülerdatenbank und Zugangskarten

In der Administrator-Kopfzeile öffnet **Schülerdatenbank** eine unabhängige Verwaltung – auch bevor die erste Ausschreibung existiert.

- Schüler suchen, nach Klasse und Status filtern, neu anlegen und bearbeiten (ID, Vorname, Nachname, Klasse).
- Schüler aktivieren und deaktivieren; Deaktivierung bei bestehenden Anmeldungen ist in der Oberfläche gesperrt.
- **Karte PDF** für einzelne Schüler, klassenweiser Druck über Klassenfilter oder alle aktiven Schüler.
- A4-Layout mit acht abtrennbaren Karten pro Blatt oder einer grossen Karte pro Blatt.
- Fehlende Codes erstellen, bestehende Codes unverändert übernehmen oder Codes nach ausdrücklicher zusätzlicher Bestätigung neu ausstellen.

### Bestehende Codes nachdrucken

Die früher erzeugten Codes sind nur als Hash gespeichert. Der Klartext ist daraus nicht wiederherstellbar. Mit der ursprünglichen Code-CSV (Spalten Schueler_ID und Zugangscode) können diese Codes unverändert in eine verschlüsselte Ablage in **Supabase Vault** übernommen werden. Erst danach ist der Nachdruck ohne Codewechsel möglich. Bei Verlust der alten CSV bleibt die ausdrücklich bestätigte Neuausgabe; dabei werden die alten Karten ungültig.

Seit dieser Version werden neue Codes serverseitig generiert und zusätzlich verschlüsselt im Vault abgelegt. Nur die verifizierte Schulverwaltung darf sie über eine geschützte Datenbankfunktion für die PDF-Erstellung abrufen. Keine Codes in GitHub oder andere öffentliche Ablagen hochladen. Die PDFs entstehen lokal im Browser mit einer festgelegten jsPDF-Version; gedruckte Karten und PDF-Dateien vertraulich behandeln.

Die Backend-Abläufe (Ausgabe, Wiederabruf, Übernahme und Wechsel) wurden mit Testtransaktionen und anschliessendem ROLLBACK geprüft. Die Bedienung und der PDF-Ausdruck im echten Browser sind noch praktisch zu testen.

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

Die Farbgestaltung orientiert sich jetzt an einem Screenshot der Schulhomepage: Himmelblau `#C8E6EB`, Kachelgrün `#DEF1DD`, Logo-Grün `#519C62` und Lindgrün `#8CCB80`. Für Bedienelemente mit weisser Schrift verwenden wir aus Lesbarkeitsgründen ein dunkleres Grün (`#347548`). Die Farbwerte wurden dem Screenshot entnommen; ein offizielles Corporate-Design-Handbuch oder das originale Schullogo wurden dafür nicht verwendet.

## Weitere mögliche Ausbaustufen

- Druckfertige persönliche Zugangskarten, feinere Rechte für mehrere Schulmitarbeitende
- Nachvollziehbare Vergleichsvarianten der Zuteilung, automatische Konflikt-/Mindestteilnehmerprüfung mit garantierter Optimalität unter zusätzlichen Nebenbedingungen
- Klare Lösch- und Archivierungsprozesse sowie automatische Testprotokolle
