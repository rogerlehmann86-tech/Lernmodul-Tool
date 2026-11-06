# Lernmodul-Tool – Oberstufenzentrum Rapperswil

**Testversion** der Verwaltung von Lernmodulen für Schülerinnen und Schüler. Weboberfläche auf GitHub Pages; Daten, Zugriffsrechte und serverseitige Berechnung auf einem **eigenen Supabase-Projekt**. Andere Tools und Datenbanken bleiben getrennt.

## Getrennte Schüler- und Administratoransicht

- Ohne Administratoranmeldung erscheint die **Schüler-Anmeldemaske**. Ausschreibungen und Module sind noch nicht sichtbar.
- Schüler melden sich mit **Schüler-ID und persönlichem Zugangscode** an und sehen ausschliesslich diejenigen Ausschreibungen, denen sie über die Schüler-Zulassung zugeordnet sind.
- Die Login-Abfrage prüft die Zugangsangaben serverseitig und gibt nur Informationen zu den berechtigten Ausschreibungen zurück. Direkte anonyme SELECT-Abfragen auf die Ausschreibungs- und Modultabellen liefern keine Datensätze mehr.
- Offene Ausschreibungen zeigen die Modulwahl, bereits abgegebene Wünsche erscheinen zur Kontrolle. Bei veröffentlichten Ergebnissen werden nur die persönlichen Zuteilungen angezeigt. Entwürfe bleiben verborgen.
- Die Schüler-Zugangsdaten werden **nicht** in localStorage, Cookies oder sessionStorage gespeichert. Sie bleiben bis zum Neuladen bzw. Abmelden nur im JavaScript-Arbeitsspeicher, damit für die Wunschabgabe kein zweiter Login nötig ist.
- Nach 8 falschen Codeversuchen für dieselbe Schüler-ID innerhalb von 15 Minuten wird dieser Login für 15 Minuten blockiert. Das ist ein Grundschutz, ersetzt aber noch kein umfassendes server-/IP-basiertes Rate-Limiting.
- Über **Administration** im Kopfbereich öffnet sich das gesonderte Anmeldeformular.
- Nach erfolgreicher Prüfung des Administratorkontos wird ausschliesslich die geführte Verwaltung angezeigt. Die drei öffentlichen Schülerbereiche stehen nicht mehr darüber.
- Ein Administrator kann über **Schüleransicht** die öffentliche Ansicht kontrollieren und mit **Zur Verwaltung** zurückwechseln, ohne sich abmelden zu müssen.
- Der Ansichtswechsel ist eine reine Darstellungssache. Die Datenbankrechte werden weiterhin ausschliesslich durch Authentifizierung und Row Level Security gesteuert.
- Für einen direkten Link zum Administrator-Login kann die Adresse mit `?ansicht=admin` verwendet werden; ein bereits angemeldeter Administrator kommt standardmässig sofort in die Verwaltung.

## Test des persönlichen Schülerportals

1. Auf der Administratorseite eine offene Ausschreibung auswählen und mindestens einen Schüler unter **Teilnehmende auswählen** zulassen.
2. Mit einem persönlichen Testcode die Schüleransicht öffnen.
3. Nach der Anmeldung erscheint **nur diese freigegebene Ausschreibung**. Ein anderer Schüler ohne diese Zulassung sieht sie nicht.
4. Wünsche speichern und danach kontrollieren, ob sie als abgegeben angezeigt werden.
5. Nach Veröffentlichung der Zuteilung sind die eigenen Ergebnisse auf derselben Seite abrufbar.
6. **Abmelden** löscht die Zugangsdaten aus dem laufenden Schülerportal; auch ein Neuladen erfordert eine neue Anmeldung.

Die Datenbankprüfungen wurden mit vollständig zurückgesetzten Testdaten durchgeführt. Die öffentliche Website wurde noch nicht mit einem realen Browser-End-to-End-Test verifiziert.

## Ausschreibungen direkt in der Übersicht sicher löschen

Jede Ausschreibung im Status **Entwurf** oder **Anmeldung offen** hat in der Übersicht rechts einen roten Button **Löschen**. Bei bereits abgeschlossenen oder zugeteilten Ausschreibungen erscheint stattdessen **Geschützt**.

Das Löschen besteht bewusst aus **zwei Schritten**:

1. **Löschung prüfen:** Ein Dialog zeigt den Ausschreibungsnamen, die Anzahl Module und der zugelassenen sowie angemeldeten Schüler. Er weist darauf hin, dass Module, Zeitblöcke und Teilnahmefreigaben mit der Ausschreibung gelöscht werden, jedoch nicht die zentralen Schülerstammdaten oder Zugangscodes.
2. **Sicherheitsbestätigung:** Der Administrator muss den vollständigen Ausschreibungsnamen exakt eintippen. Erst dann wird die Schaltfläche **Endgültig löschen** aktiv.

Zusätzlich kontrolliert die Supabase-Datenbank **erneut** die Administratorberechtigung, den ausgeschriebenen Namen, den aktuellen Status sowie vorhandene Schüleranmeldungen und Zuteilungen. Sind solche Datensätze vorhanden, wird die Löschung auch bei korrekter Bestätigung verweigert. Jede erfolgreiche Löschung wird im Änderungsprotokoll festgehalten. Der Dialog lässt sich jederzeit abbrechen. Es gibt keine automatische Löschung.

## Pflichtfeldkontrolle und Fehlermeldungen im geführten Ablauf

Die Formulare für Ausschreibungen, Module und Zeitblöcke prüfen ihre Pflichtfelder direkt im jeweiligen aufklappbaren Container. Fehlende oder ungültige Felder erhalten eine **rote Umrandung** und eine **Fehlermeldung unmittelbar unter dem Feld**. Zusätzlich erscheinen eine rote Hinweisfläche im Container und der Status **«Bitte prüfen»** an der Überschrift.

Die Weiter-Schaltflächen kontrollieren, ob notwendige Voraussetzungen erfüllt sind:

- Eine neue Ausschreibung muss vollständig erfasst und tatsächlich gespeichert sein.
- Änderungen an einem bestehenden Entwurf müssen zuerst gespeichert werden.
- Für die Modulwünsche müssen genügend aktive Module vorhanden sein; laufende Modulbearbeitungen müssen abgeschlossen werden.
- Für spätere Schritte müssen Schüler erfasst, Zugangscodes ausgegeben, Teilnehmende ausgewählt und die Anmeldung freigegeben sein.

Bei Fehlern aus Supabase, dem Modulformular, Zeitblöcken oder anderen Verwaltungsaktionen erscheint der Fehlertext auch im jeweils zugehörigen Arbeitsschritt. Der Container bleibt zur Korrektur erreichbar. Die Abschnitte lassen sich zur Kontrolle weiterhin **manuell öffnen und schliessen**; der geführte Button «Weiter» sowie die automatische Weiterschaltung kontrollieren dagegen die Voraussetzungen. Ein rot markierter Schritt wird nach erfolgreicher Korrektur beziehungsweise Speicherung zurückgesetzt.

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
**Automatische Schüler-ID:** Wer beim Erfassen das ID-Feld leer lässt, bekommt serverseitig eine eindeutige Nummer im Format `S00001`, `S00002` usw. Vorhandene Schulnummern bleiben unverändert. Nummern können aus technischen Gründen gelegentlich Lücken enthalten.

**CSV-Import in der Schülerdatenbank:** Über den Button «CSV-Vorlage herunterladen» kann die vorbereitete Tabelle direkt übernommen werden. Neue Klassen werden automatisch angelegt. Bekannte IDs werden aktualisiert; ohne ID wird ein eindeutiger Name derselben Klasse erkannt. Bei Mehrdeutigkeit oder Klassenwechsel ohne ID bricht der Import kontrolliert ab. Zugangscodes und Anmeldungen bleiben erhalten.

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
- Zentraler CSV-Import mit automatischer ID-Vergabe, vorhandenen Schulnummern und Wiedererkennung
- Zufällige Zugangscodes mit Prüf-Hash und verschlüsselter Vault-Ablage für den Nachdruck
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

1. Als Administrator anmelden und die **Schülerdatenbank** öffnen.
2. Schüler direkt erfassen (ID leer lassen) oder die **CSV-Vorlage** herunterladen und fiktive Schüler mit Klassen importieren.
3. Unter **Ausschreibungen** einen Entwurf erstellen und mindestens so viele Module erfassen, wie Wünsche verlangt werden.
4. Zugangscodes erzeugen und bei Bedarf unter **Schülerdatenbank** persönliche A4-Karten drucken.
5. Im Schritt **Teilnehmende auswählen** die gewünschten Schüler oder Klassen für diese Ausschreibung zulassen.
6. Anmeldung freigeben. Im privaten Browserfenster mit Schüler-ID und Code anmelden und nur die eigene Ausschreibung bearbeiten.
7. Anmeldungen kontrollieren, Zuteilungen berechnen und nach Prüfung Ergebnisse veröffentlichen.
8. Fiktive Testdaten nach Abschluss kontrolliert entfernen und nicht mit echten Schülerdaten vermischen.

## CSV-Format

Pflichtfelder sind `first_name;last_name;class`. Die Spalte `external_id` ist **optional**. Die herunterladbare Vorlage hat die Reihenfolge `external_id;first_name;last_name;class`. Deutsche Überschriften wie `Schüler-ID;Vorname;Nachname;Klasse` sind ebenfalls vorgesehen. Trennzeichen sind Semikolon, Komma und Tabulator. Excel-Dateien zuerst als CSV UTF-8 speichern.

- **Leere Schüler-ID:** Das Tool vergibt eine neue fortlaufende Nummer.
- **Bekannte Schüler-ID:** Vorname, Nachname und Klasse werden aktualisiert.
- **Erneuter Import ohne ID:** Ein eindeutig identifizierbarer Name derselben Klasse wird wiedererkannt.
- **Unklarer Name, andere Klasse oder widersprüchliche ID:** Der Import stoppt mit einer verständlichen Fehlermeldung. Bei einem Klassenwechsel die bisherige ID mitgeben.
- Der gesamte CSV-Import erfolgt atomar. Es entstehen keine halbfertigen Klassenlisten durch Fehler in der Datei.

## Sicherheits- und Betriebsgrenzen

- GitHub-Repository und GitHub-Pages-Website sind öffentlich. Nur Programmdateien veröffentlichen. **Keine** Schülertabellen, Zugangscodes, Passwortdateien oder geheime Supabase-Schlüssel hochladen.
- Die öffentliche Supabase-Publishable-Key ist bewusst im Browser hinterlegt. Geheimschlüssel gehören ausschliesslich auf den Server.
- SQL-RLS und administrative Serverfunktionen schützen Daten und Freigaben.
- Die Supabase-Option **Prevent use of leaked passwords** wurde aktiviert. Die automatische Sicherheitsprüfung meldete zuletzt keine Warnungen.
- Vor Produktiveinsatz: Tests im realen Browser einschliesslich Edge Function, Datenschutzfreigabe für Minderjährige, Aufbewahrungsfristen, Löschverfahren, Schutz vor automatisierten Codeversuchen/Rate-Limits, E-Mail-Absender und Zugangsverwaltung prüfen.
- Ein automatisierter End-to-End-Test der veröffentlichten Website wurde noch **nicht** durchgeführt. Serverfunktionen und das Zuteilungsverfahren wurden mit synthetischen Daten getestet; Datenbanktests liefen mit `ROLLBACK` und hinterliessen keine Schülerdaten.

## Gestaltung

Die Farbgestaltung orientiert sich jetzt an einem Screenshot der Schulhomepage: Himmelblau `#C8E6EB`, Kachelgrün `#DEF1DD`, Logo-Grün `#519C62` und Lindgrün `#8CCB80`. Für Bedienelemente mit weisser Schrift verwenden wir aus Lesbarkeitsgründen ein dunkleres Grün (`#347548`). Die Farbwerte wurden dem Screenshot entnommen; ein offizielles Corporate-Design-Handbuch oder das originale Schullogo wurden dafür nicht verwendet.

## Weitere mögliche Ausbaustufen

- Druckfertige persönliche Zugangskarten, feinere Rechte für mehrere Schulmitarbeitende
- Nachvollziehbare Vergleichsvarianten der Zuteilung, automatische Konflikt-/Mindestteilnehmerprüfung mit garantierter Optimalität unter zusätzlichen Nebenbedingungen
- Klare Lösch- und Archivierungsprozesse sowie automatische Testprotokolle
