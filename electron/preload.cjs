// Préload minimal — l'app est 100% renderer (localStorage), aucun accès Node exposé.
// Conservé comme point d'extension (IPC futur : printToPDF, dialogues natifs...).
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  isElectron: true,
})
