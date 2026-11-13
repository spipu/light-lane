/**
 * Every user-facing text of Light Lane, served by AppTranslator. The codes shared with Spipu-Racing keep its texts.
 *
 * Proper nouns are not translated (the brand, language autonyms).
 */
class LightLaneTranslations {
    static get CATALOG() {
        return {
            // --- Reused from racing, same texts ---
            'menu.options': {
                fr: 'Options',
                en: 'Options',
                it: 'Opzioni',
                es: 'Opciones'
            },
            'menu.help': {
                fr: 'Aide',
                en: 'Help',
                it: 'Aiuto',
                es: 'Ayuda'
            },
            'menu.storageUnavailable': {
                fr: 'Stockage navigateur indisponible — les paramètres ne seront pas enregistrés.',
                en: 'Browser storage unavailable — the settings will not be saved.',
                it: 'Archiviazione del browser non disponibile — le impostazioni non verranno salvate.',
                es: 'Almacenamiento del navegador no disponible — los ajustes no se guardarán.'
            },
            'options.display': {
                fr: 'Affichage',
                en: 'Display',
                it: 'Visualizzazione',
                es: 'Pantalla'
            },
            'options.sound': {
                fr: 'Son',
                en: 'Sound',
                it: 'Audio',
                es: 'Sonido'
            },
            'options.controls': {
                fr: 'Contrôles',
                en: 'Controls',
                it: 'Comandi',
                es: 'Controles'
            },
            'options.reset': {
                fr: 'Réinitialiser tous les paramètres',
                en: 'Reset all settings',
                it: 'Reimposta tutte le impostazioni',
                es: 'Restablecer todos los ajustes'
            },
            'options.resetConfirm': {
                fr: 'Supprimer tous les paramètres enregistrés ?',
                en: 'Delete every saved setting?',
                it: 'Eliminare tutte le impostazioni salvate?',
                es: '¿Eliminar todos los ajustes guardados?'
            },
            'options.resetDetail': {
                fr: 'Tous les réglages reviennent à leur valeur par défaut, contrôles compris.',
                en: 'Every setting goes back to its default, the controls included.',
                it: 'Tutte le impostazioni tornano al valore predefinito, comandi compresi.',
                es: 'Todos los ajustes vuelven a su valor predeterminado, controles incluidos.'
            },
            'settings.controls.device': {
                fr: 'Appareil',
                en: 'Device',
                it: 'Dispositivo',
                es: 'Dispositivo'
            },
            'device.automatic': {
                fr: 'Automatique',
                en: 'Automatic',
                it: 'Automatico',
                es: 'Automático'
            },
            'device.auto': {
                fr: 'Automatique : {device}',
                en: 'Automatic: {device}',
                it: 'Automatico: {device}',
                es: 'Automático: {device}'
            },
            'device.keyboard': {
                fr: 'Clavier',
                en: 'Keyboard',
                it: 'Tastiera',
                es: 'Teclado'
            },
            'device.gamepadAny': {
                fr: 'Manette',
                en: 'Gamepad',
                it: 'Controller',
                es: 'Mando'
            },
            'device.gamepad': {
                fr: 'Manette ({name})',
                en: 'Gamepad ({name})',
                it: 'Controller ({name})',
                es: 'Mando ({name})'
            },
            'device.virtualPad': {
                fr: 'Commandes tactiles',
                en: 'Touch controls',
                it: 'Comandi touch',
                es: 'Controles táctiles'
            },
            'settings.display.language': {
                fr: 'Langue',
                en: 'Language',
                it: 'Lingua',
                es: 'Idioma'
            },
            'settings.display.renderer': {
                fr: 'Moteur de rendu',
                en: 'Rendering engine',
                it: 'Motore di rendering',
                es: 'Motor de renderizado'
            },
            'settings.display.showFps': {
                fr: 'Afficher le framerate',
                en: 'Show the framerate',
                it: 'Mostra il frame rate',
                es: 'Mostrar los FPS'
            },
            'settings.sound.volumeEffects': {
                fr: 'Volume des effets',
                en: 'Effects volume',
                it: 'Volume degli effetti',
                es: 'Volumen de los efectos'
            },
            'value.renderer.softwareTextured': {
                fr: 'Logiciel texturé',
                en: 'Software textured',
                it: 'Software con texture',
                es: 'Software con texturas'
            },
            'value.renderer.softwareFlat': {
                fr: 'Logiciel en aplats',
                en: 'Software flat',
                it: 'Software a tinte piatte',
                es: 'Software plano'
            },
            'value.renderer.softwareWireframe': {
                fr: 'Logiciel filaire',
                en: 'Software wireframe',
                it: 'Software wireframe',
                es: 'Software de alambre'
            },
            'settings.action.pause': {
                fr: 'Pause',
                en: 'Pause',
                it: 'Pausa',
                es: 'Pausa'
            },
            'hud.fps': {
                fr: '{value} fps',
                en: '{value} fps',
                it: '{value} fps',
                es: '{value} fps'
            },
            // --- Light Lane ---
            'menu.play': {
                fr: 'Jouer',
                en: 'Play',
                it: 'Gioca',
                es: 'Jugar'
            },
            'menu.bestScores': {
                fr: 'Meilleurs scores',
                en: 'Best scores',
                it: 'Migliori punteggi',
                es: 'Mejores puntuaciones'
            },
            'scores.rank': {
                fr: 'Rang',
                en: 'Rank',
                it: 'Posizione',
                es: 'Puesto'
            },
            'scores.score': {
                fr: 'Score',
                en: 'Score',
                it: 'Punteggio',
                es: 'Puntuación'
            },
            'scores.coins': {
                fr: 'Pièces',
                en: 'Coins',
                it: 'Monete',
                es: 'Monedas'
            },
            'scores.distance': {
                fr: 'Distance',
                en: 'Distance',
                it: 'Distanza',
                es: 'Distancia'
            },
            'scores.date': {
                fr: 'Date',
                en: 'Date',
                it: 'Data',
                es: 'Fecha'
            },
            'scores.empty': {
                fr: 'Aucun score pour l’instant.',
                en: 'No score yet.',
                it: 'Ancora nessun punteggio.',
                es: 'Aún no hay puntuaciones.'
            },
            'scores.clear': {
                fr: 'Tout effacer',
                en: 'Clear all',
                it: 'Cancella tutto',
                es: 'Borrar todo'
            },
            'scores.clearConfirm': {
                fr: 'Effacer tous les scores ?',
                en: 'Clear all scores?',
                it: 'Cancellare tutti i punteggi?',
                es: '¿Borrar todas las puntuaciones?'
            },
            'scores.clearDetail': {
                fr: 'Les 10 meilleurs scores seront perdus.',
                en: 'The 10 best scores will be lost.',
                it: 'I 10 migliori punteggi andranno persi.',
                es: 'Se perderán las 10 mejores puntuaciones.'
            },
            'scores.failed': {
                fr: 'Les scores n’ont pas pu être lus ou enregistrés.',
                en: 'The scores could not be read or written.',
                it: 'Non è stato possibile leggere o salvare i punteggi.',
                es: 'No se han podido leer ni guardar las puntuaciones.'
            },
            'game.failed': {
                fr: 'La course s’est arrêtée sur une erreur.',
                en: 'The run stopped on an error.',
                it: 'La corsa si è interrotta per un errore.',
                es: 'La carrera se detuvo por un error.'
            },
            'pause.title': {
                fr: 'Pause',
                en: 'Pause',
                it: 'Pausa',
                es: 'Pausa'
            },
            'pause.resume': {
                fr: 'Reprendre',
                en: 'Resume',
                it: 'Riprendi',
                es: 'Reanudar'
            },
            'pause.restart': {
                fr: 'Recommencer',
                en: 'Restart',
                it: 'Ricomincia',
                es: 'Reiniciar'
            },
            'pause.quit': {
                fr: 'Quitter',
                en: 'Quit',
                it: 'Esci',
                es: 'Salir'
            },
            'pause.restartConfirm': {
                fr: 'Recommencer la course ?',
                en: 'Restart the run?',
                it: 'Ricominciare la corsa?',
                es: '¿Reiniciar la carrera?'
            },
            'pause.quitConfirm': {
                fr: 'Quitter la course ?',
                en: 'Quit the run?',
                it: 'Uscire dalla corsa?',
                es: '¿Salir de la carrera?'
            },
            'pause.lostDetail': {
                fr: 'Le score de cette course sera perdu.',
                en: 'The score of this run will be lost.',
                it: 'Il punteggio di questa corsa andrà perso.',
                es: 'Se perderá la puntuación de esta carrera.'
            },
            'over.title': {
                fr: 'Course terminée',
                en: 'Run over',
                it: 'Corsa finita',
                es: 'Carrera terminada'
            },
            'over.record': {
                fr: 'Nouveau record !',
                en: 'New record!',
                it: 'Nuovo record!',
                es: '¡Nuevo récord!'
            },
            'over.rank': {
                fr: '{rank}e meilleur score',
                en: '{rank}th best score',
                it: '{rank}° miglior punteggio',
                es: '{rank}.ª mejor puntuación'
            },
            'over.rank2': {
                fr: '2e meilleur score',
                en: '2nd best score',
                it: '2° miglior punteggio',
                es: '2.ª mejor puntuación'
            },
            'over.rank3': {
                fr: '3e meilleur score',
                en: '3rd best score',
                it: '3° miglior punteggio',
                es: '3.ª mejor puntuación'
            },
            'over.best': {
                fr: 'Meilleur score',
                en: 'Best score',
                it: 'Miglior punteggio',
                es: 'Mejor puntuación'
            },
            'over.replay': {
                fr: 'Rejouer',
                en: 'Play again',
                it: 'Rigioca',
                es: 'Volver a jugar'
            },
            'settings.display.bloom': {
                fr: 'Effets lumineux',
                en: 'Light effects',
                it: 'Effetti luminosi',
                es: 'Efectos de luz'
            },
            'settings.action.left': {
                fr: 'Gauche',
                en: 'Left',
                it: 'Sinistra',
                es: 'Izquierda'
            },
            'settings.action.right': {
                fr: 'Droite',
                en: 'Right',
                it: 'Destra',
                es: 'Derecha'
            },
            'settings.action.jump': {
                fr: 'Sauter',
                en: 'Jump',
                it: 'Salta',
                es: 'Saltar'
            },
            'settings.action.slide': {
                fr: 'Glisser',
                en: 'Slide',
                it: 'Scivola',
                es: 'Deslizarse'
            },
            'settings.action.leftRight': {
                fr: 'Gauche / droite',
                en: 'Left / right',
                it: 'Sinistra / destra',
                es: 'Izquierda / derecha'
            },
            'settings.action.jumpSlide': {
                fr: 'Sauter / glisser',
                en: 'Jump / slide',
                it: 'Salta / scivola',
                es: 'Saltar / deslizarse'
            },
            'hud.best': {
                fr: 'MEILLEUR',
                en: 'BEST',
                it: 'RECORD',
                es: 'RÉCORD'
            },
            'hud.go': {
                fr: 'GO',
                en: 'GO',
                it: 'VIA',
                es: 'YA'
            },
            'help.play': {
                fr: 'Comment jouer',
                en: 'How to play',
                it: 'Come si gioca',
                es: 'Cómo jugar'
            },
            'help.goal': {
                fr: 'Courez le plus loin possible. La piste ne finit jamais et devient de plus en plus rapide et difficile.',
                en: 'Run as far as you can. The track never ends and gets faster and harder.',
                it: 'Corri il più lontano possibile. La pista non finisce mai e diventa sempre più veloce e difficile.',
                es: 'Corre lo más lejos posible. La pista nunca termina y se vuelve cada vez más rápida y difícil.'
            },
            'help.controls': {
                fr: 'Gauche / droite : changer de voie. Haut : sauter. Bas : glisser (en l’air : redescendre aussitôt). Sur un écran tactile, glissez le doigt dans les mêmes directions.',
                en: 'Left / right: change lane. Up: jump. Down: slide (in the air: drop at once). On a touch screen, swipe in the same directions.',
                it: 'Sinistra / destra: cambia corsia. Su: salta. Giù: scivola (in aria: scendi subito). Su uno schermo tattile, scorri il dito nelle stesse direzioni.',
                es: 'Izquierda / derecha: cambiar de carril. Arriba: saltar. Abajo: deslizarse (en el aire: bajar al instante). En una pantalla táctil, desliza el dedo en las mismas direcciones.'
            },
            'help.colors': {
                fr: 'Le cyan vous aide, l’ambre vous prévient, l’orange vous fait trébucher, le rouge est mortel.',
                en: 'Cyan helps you, amber warns you, orange trips you, red is fatal.',
                it: 'Il ciano ti aiuta, l’ambra ti avvisa, l’arancione ti fa inciampare, il rosso è mortale.',
                es: 'El cian te ayuda, el ámbar te avisa, el naranja te hace tropezar, el rojo es mortal.'
            },
            'help.obstacles': {
                fr: 'Sautez les haies, glissez sous les portiques, changez de voie devant les blocs et les engins, sautez les brèches. Les voies qui passent au rouge finissent dans le vide.',
                en: 'Jump hurdles, slide under gates, change lane in front of blocks and vehicles, jump over gaps. Lanes that turn red end in the void.',
                it: 'Salta gli ostacoli bassi, scivola sotto le travi, cambia corsia davanti ai blocchi e ai veicoli, salta le voragini. Le corsie che diventano rosse finiscono nel vuoto.',
                es: 'Salta las vallas, deslízate bajo los pórticos, cambia de carril ante los bloques y los vehículos, salta los huecos. Los carriles que se vuelven rojos terminan en el vacío.'
            },
            'help.hits': {
                fr: 'Un choc de face termine la course. Un choc de côté vous fait trébucher ; deux faux pas en moins de 5 secondes et la course est finie.',
                en: 'Hitting something head-on ends the run. Hitting it from the side makes you stumble; stumble twice within 5 seconds and the run is over.',
                it: 'Un urto frontale termina la corsa. Un urto laterale ti fa inciampare; due inciampi in meno di 5 secondi e la corsa è finita.',
                es: 'Un choque de frente termina la carrera. Un choque lateral te hace tropezar; dos tropiezos en menos de 5 segundos y la carrera se acaba.'
            },
            'help.powerups': {
                fr: 'Score double, aimant, bouclier, bottes de saut et envol, chacun pendant quelques secondes.',
                en: 'Double score, magnet, shield, jump boots and flight, each for a few seconds.',
                it: 'Punteggio doppio, calamita, scudo, stivali da salto e volo, ciascuno per qualche secondo.',
                es: 'Puntuación doble, imán, escudo, botas de salto y vuelo, cada uno durante unos segundos.'
            },
            'help.sentinel': {
                fr: 'La Sentinelle vole devant vous et tire : un trait rouge sur votre voie (changez de voie), ou un rayon ambre (sautez ou glissez).',
                en: 'The Sentinel flies ahead and fires: a red line on your lane (change lane), or an amber beam (jump or slide).',
                it: 'La Sentinella vola davanti a te e spara: una linea rossa sulla tua corsia (cambia corsia) o un raggio ambra (salta o scivola).',
                es: 'El Centinela vuela delante y dispara: una línea roja en tu carril (cambia de carril) o un rayo ámbar (salta o deslízate).'
            },
            'help.score': {
                fr: 'Un point par mètre, cinq par pièce. Les 10 meilleurs scores sont gardés.',
                en: 'One point per metre, five per coin. The 10 best scores are kept.',
                it: 'Un punto per metro, cinque per moneta. Vengono conservati i 10 migliori punteggi.',
                es: 'Un punto por metro, cinco por moneda. Se guardan las 10 mejores puntuaciones.'
            },
            'help.performance': {
                fr: 'Si le jeu saccade, coupez les effets lumineux dans les options.',
                en: 'If the game stutters, turn the light effects off in the options.',
                it: 'Se il gioco scatta, disattiva gli effetti luminosi nelle opzioni.',
                es: 'Si el juego va a tirones, desactiva los efectos de luz en las opciones.'
            },
            'help.pauseKey': {
                fr: 'Échap, le bouton Start ou le bouton pause met la course en pause.',
                en: 'Escape, the Start button or the pause button pauses the run.',
                it: 'Esc, il tasto Start o il pulsante pausa mettono in pausa la corsa.',
                es: 'Escape, el botón Start o el botón de pausa ponen la carrera en pausa.'
            },
            'help.about': {
                fr: 'À propos',
                en: 'About',
                it: 'Informazioni',
                es: 'Acerca de'
            },
            'help.about.what': {
                fr: 'Light Lane, une course sans fin au néon.',
                en: 'Light Lane, an endless neon lane runner.',
                it: 'Light Lane, una corsa infinita al neon.',
                es: 'Light Lane, una carrera infinita de neón.'
            },
            'help.about.author': {
                fr: 'Par Spipu. Moteur : Spipu3D (github.com/spipu/3d-engine).',
                en: 'By Spipu. Engine: Spipu3D (github.com/spipu/3d-engine).',
                it: 'Di Spipu. Motore: Spipu3D (github.com/spipu/3d-engine).',
                es: 'Por Spipu. Motor: Spipu3D (github.com/spipu/3d-engine).'
            },
            'help.about.font': {
                fr: 'Police : Oswald (SIL Open Font License).',
                en: 'Font: Oswald (SIL Open Font License).',
                it: 'Carattere: Oswald (SIL Open Font License).',
                es: 'Fuente: Oswald (SIL Open Font License).'
            },
            'help.about.mocap': {
                fr: 'Capture de mouvement : CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu).',
                en: 'Motion capture: CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu).',
                it: 'Motion capture: CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu).',
                es: 'Captura de movimiento: CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu).'
            },
            'help.about.copyright': {
                fr: '© {year} Spipu',
                en: '© {year} Spipu',
                it: '© {year} Spipu',
                es: '© {year} Spipu'
            }
        };
    }
}
