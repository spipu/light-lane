/**
 * The gallery (gameplay § 14, art § 10): on the left the list of its items, the locked ones as « ??? » (greyed, a
 * notice in the view); on the right the item highlighted in 3D (LightLaneGalleryView), its name only in the list (user request). Up / Down walk the list,
 * Left / Right (held), the gamepad's stick or a finger dragged across the view (any way) turn the item.
 */
class GalleryScreen extends AbstractLightLaneMenuScreen {
    constructor(navigator, display) {
        super(navigator, display);

        this._view      = null;
        this._lockedEl  = null;
        this._items     = [];      // the items in the order of their list entries, null where locked
        this._held      = {left: false, right: false};
        this._swipeX    = null;    // the finger's last position on the view, null while none is down
        this._swipeY    = 0;
        this._swipeId   = null;    // the pointer followed (the first down; another finger is ignored)
        this._onKeyDown = (event) => this._key(event, true);
        this._onKeyUp   = (event) => this._key(event, false);
        this._onBlur    = () => this._release();
    }

    _build() {
        const {panel, listEl} = this._buildPanel(appTranslator.get('menu.gallery'));
        const detail = this._addDetailPanel();
        this._container.classList.add('light-lane-gallery');
        detail.classList.add('light-lane-gallery-detail');
        const host   = AppMenuDom.addElement(detail, 'div', 'light-lane-gallery-view');
        this._lockedEl = AppMenuDom.addText(detail, 'light-lane-gallery-locked', appTranslator.get('gallery.notUnlocked'));
        this._bindSwipe(host);

        // Every item in the list, the locked ones too (user request): « ??? », greyed, nothing in the view but a notice.
        this._items = LightLaneTuning.GALLERY_ITEMS.map((item) => (lightLaneGallery.isUnlocked(item) ? item : null));
        for (const item of this._items) {
            const entry = this._nav.addItemIn(listEl, appTranslator.get((item !== null) ? ('gallery.' + item) : 'gallery.locked'), () => {});
            if (item === null) {
                entry.classList.add(MainMenuScreen.LOCKED_CLASS);
            }
        }
        this._addBackButton(panel);
        this._nav.setOnSelect((index) => this._select(index));

        this._view = new LightLaneGalleryView(host).start(this._items[0]);
        // Its first item shown (setOnSelect).
        this._nav.selectFirst();
        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('blur', this._onBlur);
    }

    hide() {
        this._swipeX  = null;
        this._swipeId = null;
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup', this._onKeyUp);
        window.removeEventListener('blur', this._onBlur);
        if (this._view !== null) {
            this._view.stop();
            this._view = null;
        }

        return super.hide();
    }

    _onBack() {
        this._navigator.showMainMenu();
    }

    _select(index) {
        const item = this._items[index];
        if ((item === undefined) || (this._view === null)) {
            return;
        }
        this._lockedEl.classList.toggle(GalleryScreen.SHOWN_CLASS, (item === null));
        this._view.show(item);
    }

    // Left / Right held turn the item (the list's own navigation ignores them: its entries have no value to change; on
    // the Back button they walk nothing and still turn it, which is harmless).
    _key(event, down) {
        if ((event.key !== GalleryScreen.KEY_LEFT) && (event.key !== GalleryScreen.KEY_RIGHT)) {
            return;
        }
        this._held[(event.key === GalleryScreen.KEY_LEFT) ? 'left' : 'right'] = (down && !this._navBlocked());
        this._applyTurn();
    }

    _release() {
        this._held.left  = false;
        this._held.right = false;
        this._applyTurn();
    }

    _applyTurn() {
        if (this._view !== null) {
            this._view.setTurn((this._held.right ? 1 : 0) - (this._held.left ? 1 : 0));
        }
    }

    // A finger (or the mouse, button down) moved across the view turns the item, up and down too (user request).
    _bindSwipe(host) {
        host.addEventListener('pointerdown', (event) => {
            if (this._swipeId !== null) {
                return;
            }
            this._swipeId = event.pointerId;
            this._swipeX  = event.clientX;
            this._swipeY  = event.clientY;
            host.setPointerCapture(event.pointerId);
        });
        host.addEventListener('pointermove', (event) => {
            if ((this._swipeX === null) || (event.pointerId !== this._swipeId) || (this._view === null)) {
                return;
            }
            this._view.swipe((event.clientX - this._swipeX), (event.clientY - this._swipeY));
            this._swipeX = event.clientX;
            this._swipeY = event.clientY;
        });
        const end = (event) => {
            if (event.pointerId !== this._swipeId) {
                return;
            }
            this._swipeX  = null;
            this._swipeId = null;
        };
        host.addEventListener('pointerup', end);
        host.addEventListener('pointercancel', end);
        host.addEventListener('lostpointercapture', end);
    }
}

GalleryScreen.KEY_LEFT    = 'ArrowLeft';
GalleryScreen.KEY_RIGHT   = 'ArrowRight';
// The notice of a locked item, shown.
GalleryScreen.SHOWN_CLASS = 'light-lane-gallery-locked-shown';
