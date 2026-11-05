# Lernmodul-Tool | Oberstufenzentrum Rapperswil

Webanwendung zur Verwaltung von Lernmodulen und Modulwünschen. Dieses Repository enthält ausschliesslich **öffentlich lieferbare Programmdateien**. Es enthält keine echten Schülerdaten, keine Zugangscodes und keine geheimen Supabase-Schlüssel.

## Funktionsstand (Testbetrieb)

- Supabase-Login mit E-Mail-Bestätigung und kontrollierter Administratorfreigabe
- Ausschreibungsentwürfe mit Zeitfenstern, gewünschter Modulzahl und Anzahl Präferenzen
- Module mit Mindest- und Höchstkapazität
- CSV-Schülerimport mit automatisch erkannten Trennzeichen und deutsch/englischen Spaltenüberschriften
- Persönliche Zugangscodes (zufällig generiert, nur Hash in der Datenbank)
- Codes einmalig als CSV herunterladen, einzelne Codes bei Bedarf ersetzen
- Schüler für eine Ausschreibung zulassen; Ausschreibungen freigeben
- Öffentlicher Modulkatalog und Schüler-Anmeldung mit geordneter Wunschliste
- Serverseitige Prüfung von Schüler-ID, Code, Zeitraum, Modulen, Anzahl Wünsche und Doppelanmeldungen
- Sicherheitsprüfung der Supabase-Datenbank ohne Warnungen; erfolgreicher anonymer Testablauf mit zurückgerollten Testdaten

**Noch nicht produktionsreif:** Automatische faire Zuteilung, Zeitslotkonflikte in der Zuteilung, manuelle Zuteilungskorrekturen und Freigabe/Export der Endresultate fehlen. Ein echtes End-to-End-UI-Testing und eine Datenschutzfreigabe für den Schuleinsatz stehen aus. Keine echten Schülerdaten laden.

## GitHub Pages veröffentlichen

1. In GitHub > Repository > Settings > Pages **Deploy from a branch** wählen.
2. Branch `main`, Verzeichnis `/ (root)`, **Save**.
3. Die geplante URL ist `https://rogerlehmann86-tech.github.io/Lernmodul-Tool/`; bitte im Browser prüfen.

## Supabase-Authentifizierung konfigurieren

In [Authentication > URL Configuration](https://supabase.com/dashboard/project/htqcyvhzrtrmtlqqdzly/auth/url-configuration) die Site URL auf die veröffentlichte GitHub-Pages-Adresse setzen und dieselbe vollständige Adresse unter Redirect URLs eintragen. Sonst können E-Mail-Bestätigungen und Passwort-Zurücksetzen falsch weiterleiten.

Die in der Datenbank hinterlegte, verifizierte erste Administratoradresse erhält ihre Berechtigungen automatisch nach erfolgreicher Bestätigung. Ein anderer Login erhält **keinen** Administratorzugang.

## Durchspielen mit fiktiven Testdaten

1. Mit der vorab hinterlegten Administratoradresse registrieren und E-Mail bestätigen.
2. Anmelden und eine Ausschreibung als Entwurf anlegen. Start in der Vergangenheit, Ende in der Zukunft.
3. Mindestens so viele Module anlegen wie gewählte Wünsche.
4. `samples/test-schueler.csv` im Tab «Schüler» importieren.
5. Die fehlenden Zugangscodes erzeugen. **Die heruntergeladene CSV sicher aufbewahren:** die Codes werden nicht im Klartext gespeichert und können nicht nachträglich angezeigt werden.
6. Alle aktiven Schüler für die Ausschreibung zulassen.
7. Ausschreibung freigeben, Website aktualisieren, Schüler-ID und Code aus der heruntergeladenen CSV zum Test benutzen.
8. Für den Test die gewünschte Zahl unterschiedlicher Module wählen und speichern. Dieselbe Schüler-ID kann sich zur gleichen Ausschreibung nicht ein zweites Mal anmelden.

**Wichtig:** Die Beispiel-Schüler sind rein fiktiv. Vor echtem Betrieb müssen Testdatensätze wieder gelöscht werden.

## CSV-Format

Mindestens die vier Spalten `external_id;first_name;last_name;class`. Deutsche Überschriften (`Schüler-ID`, `Vorname`, `Nachname`, `Klasse`) werden ebenfalls akzeptiert. Semikolon, Komma oder Tabulator als Trennzeichen sind möglich. Excel-Dateien zuvor als CSV UTF-8 exportieren.

## Sicherheit

- Der im Client enthaltene `sb_publishable_...`-Schlüssel ist öffentlich verwendbar; **niemals** `service_role`, Secret Keys, Passwörter oder echte Schülerdaten im Repository speichern.
- Schülerdaten und Code-Hashes sind für nicht angemeldete Benutzer nicht auslesbar.
- Die Registrierung wird in einer serverseitigen Transaktion validiert.
- CSV mit Zugangscodes nur an berechtigte Mitarbeitende herausgeben und nach der Ausgabe sicher löschen bzw. geschützt ablegen.
- Vor Inbetriebnahme Datenschutzkonzept, Aufbewahrung, Zugangsverwaltung, Rate-Limits und Schulfreigabe prüfen.

## Gestaltung

Das aktuelle Layout orientiert sich an der Schule. Die exakten Originalfarben und das offizielle Logo wurden noch nicht verifiziert und sind deshalb bewusst noch nicht als vermeintlich offizielle Grafik eingebaut.

Supabase-Projekt: https://supabase.com/dashboard/project/htqcyvhzrtrmtlqqdzly
