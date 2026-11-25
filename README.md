# EntreDeux

**Apprends l’anglais en flirtant ou en te faisant des amis.**

Application web bilingue (français / anglais) combinant rencontres, partenaires d’entraînement IA, traduction contextuelle, lecture vocale et carnet de vocabulaire personnel.

## Déploiement gratuit depuis GitHub (sans carte bancaire)

Ce dépôt inclut un fichier `render.yaml` prêt à l’emploi pour **Render** (offre gratuite sans carte bancaire).

### Étapes rapides

1. **Exporter vers GitHub** : utilise l’onglet **GitHub** dans Google AI Studio pour créer ton dépôt.
2. **Déployer sur Render** :
   - Crée un compte gratuit sur [render.com](https://render.com) avec ton compte GitHub.
   - Clique sur **New → Blueprint** (ou **Web Service**) et sélectionne ton dépôt `EntreDeux`.
   - Renseigne la variable d’environnement `GEMINI_API_KEY` (obtenue gratuitement sur Google AI Studio).
   - Commande de build : `npm install && npm run build`
   - Commande de démarrage : `npm start`
3. **Autoriser le domaine dans Firebase Authentication** :
   - Ouvre la [console Firebase](https://console.firebase.google.com) → projet `gen-lang-client-0272897351` → **Authentication → Settings → Authorized domains**.
   - Ajoute ton domaine Render (ex. `entredeux.onrender.com`) pour que la connexion Google fonctionne sur le site en ligne.

## Développement local

```bash
npm install
cp .env.example .env
# Ajoute GEMINI_API_KEY dans .env
npm run dev
```
