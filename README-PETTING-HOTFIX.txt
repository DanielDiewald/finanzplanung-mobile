Capyt 2.2.5a – Petting Hotfix
============================

Aenderungen:
- Haptik wird bei jeder gueltigen Rubbelbewegung versucht, nicht nur bei einzelnen Richtungswechseln.
- Beim laengeren Streicheln erscheinen progressiv mehr Herzen gleichzeitig (ohne Zahlen).
- Bindung/Zuneigung und Streichel-Happiness steigen erst nach einem echten laengeren Rubbel-Meilenstein.
- Der Meilenstein erzeugt einen staerkeren Herzschauer und ein staerkeres Vibrationsmuster.
- Die PWA nutzt fuer diesen Hotfix einen neuen Service-Worker-Build-Key.

Hinweis zur Vibration:
Die Anwendung verwendet die standardisierte Navigator.vibrate()-API. Auf Browsern/Geraeten ohne diese API kann eine reine Web/PWA-App keine Systemvibration erzwingen.
