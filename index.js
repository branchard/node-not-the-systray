const native = require('./notify_icon.node');

const { NotifyIcon: NativeNotifyIcon, Icon, Menu: NativeMenu } = native;

let currentMenuItemId = 1;

class MenuItem {
    constructor(options){
        this.id = currentMenuItemId++;
        this.setProperties(options);
    }

    setProperties({text, disabled, checked, onClick, subMenuItems, ...rest}){
        if(text !== undefined){
            this.text = String(text);
        }
        
        if(disabled !== undefined){
            this.disabled = Boolean(disabled);
        }
        
        if(checked !== undefined){
            this.checked = Boolean(checked);
        }

        if(onClick !== undefined){
            if(typeof onClick !== "function"){
                throw "onClick must be undefined or a function"
            }
            this.onClick = onClick;
        }

        if(subMenuItems !== undefined){
            this.subMenuItems = subMenuItems;
        }

        Object.assign(this, rest);
    }

    toNativeNotation() {
        const nativeNotation =  { 
            id: this.id,
            text: this.text, 
            disabled: this.disabled,
            checked: this.checked,
        };

        if(this.subMenuItems !== undefined){
            nativeNotation.items = [];
            for (const subMenuItem of this.subMenuItems) {
                nativeNotation.items.push(subMenuItem.toNativeNotation());
            }
        }

        return nativeNotation;
    }

    bindNativeMenu(nativeMenu){
        this.nativeMenu = nativeMenu;
        if(this.subMenuItems !== undefined){
            this.subMenuItems.forEach((subMenuItem) => {subMenuItem.bindNativeMenu(nativeMenu);});
        }
    }

    update(newState){
        if(this.nativeMenu === undefined){
            throw "You must call bindNativeMenu before update this MenuItem";
        }
        this.setProperties(newState);
        this.nativeMenu.update(this.id, newState);
    }
}

class MenuSeparator {
    toNativeNotation() {
        return { separator: true };
    }
}

class Menu {
    constructor(items){
        this.items = items;
        this.nativeMenu;

        const nativeMenuArg = [];

        for (const item of items) {
            if(item instanceof MenuItem || item instanceof MenuSeparator){
                nativeMenuArg.push(item.toNativeNotation());
                continue;
            }
            throw "Menu items must be instance of MenuItem or MenuSeparator"
        }
        
        this.nativeMenu = new NativeMenu(nativeMenuArg);

        // bind nativeMenu to MenuItems
        for (const item of items) {
            if(item instanceof MenuItem){
                item.bindNativeMenu(this.nativeMenu);
            }
        }
    }

    findItemById(id){
        // find recustively in submenu
        const recustivelyFind = function(items){
            for (const item of items) {
                if(item.subMenuItems){
                    return recustivelyFind(item.subMenuItems);
                }

                if(item.id === id){
                    return item;
                }
            }
            
            return undefined
        };
        return recustivelyFind(this.items);
    }

    onSelect(event, notifyIcon){
        // this function show menu
        const itemId = this.nativeMenu.showSync(event.mouseX, event.mouseY);
        if(itemId === null || itemId === 0){
            return;
        }

        const item = this.findItemById(itemId);
        if(item === undefined || item.onClick === undefined){
            return;
        }

        item.onClick(new ItemClickEvent({notifyIcon}));
    }
}

class NotifyIcon {
    constructor(options){
        this.setProperties(options);
    }

    onSelect(event){
        if(event.rightButton && this.rightClickMenu !== undefined){
            this.rightClickMenu.onSelect(event, this);
        }else if(!event.rightButton && this.leftClickMenu !== undefined){
            this.leftClickMenu.onSelect(event, this);
        }else if(this.menu !== undefined){
            this.menu.onSelect(event, this);
        }
    }

    setProperties({ menu, leftClickMenu, rightClickMenu, icon, tooltip }){
        if(menu !== undefined){
            this.menu = menu;
        }
        
        if(leftClickMenu !== undefined){
            this.leftClickMenu = leftClickMenu;
        }
        
        if(rightClickMenu !== undefined){
            this.rightClickMenu = rightClickMenu;
        }

        if(icon !== undefined){
            this.icon = icon;
        }

        if(tooltip !== undefined){
            this.tooltip = tooltip;
        }

        if(this.nativeNotifyIcon === undefined){
            this.nativeNotifyIcon = new NativeNotifyIcon({
                icon: this.icon,
                tooltip: this.tooltip,
                onSelect: this.onSelect.bind(this),
            });
        }else{
            this.nativeNotifyIcon.update({
                icon: this.icon,
                tooltip: this.tooltip,
            });
        }
    }

    update(newState){
        this.setProperties(newState);
    }
}

class ItemClickEvent {
    constructor({notifyIcon}){
        this.notifyIcon = notifyIcon;
    }
}

module.exports = { NotifyIcon, Icon, Menu, MenuItem, MenuSeparator };

Object.defineProperties(NativeMenu, {
    createTemplate: { value: createMenuTemplate, enumerable: true },
});

Object.defineProperties(Icon, {
    ids: {
        enumerable: true,
        value: Object.create(null, {
            app: { value: 32512, enumerable: true },
            error: { value: 32513, enumerable: true },
            question: { value: 32514, enumerable: true },
            warning: { value: 32515, enumerable: true },
            info: { value: 32516, enumerable: true },
            winLogo: { value: 32517, enumerable: true },
            shield: { value: 32518, enumerable: true },
        }),
    },
    load: {
        enumerable: true,
        value: function Icon_load(pathOrId, size) {
            switch (typeof pathOrId) {
                default:
                    throw new Error("'pathOrId' should be either a file path or a property of Icon.ids.");
                case "number":
                    return Icon.loadBuiltin(pathOrId, size);
                case "string":
                    return Icon.loadFile(pathOrId, size);
            }
        },
    },
});

function createMenuTemplate(items) {
    // Generates a MENUEX binary resource structure to be
    // loaded by LoadMenuIndirectW().
    // Docs are pretty garbarge here, I found the wine resource
    // compiler source helpful for some of the edge cases.
    // https://github.com/wine-mirror/wine/blob/master/tools/wrc/genres.c

    // struct MENUEX_TEMPLATE_HEADER {
    //   0 uint16 version = 1;
    //   2 uint16 offset = 4;
    //   4 uint32 helpId = 0;
    // };
    const header = Buffer.alloc(8);
    header.writeUInt16LE(1, 0); // version
    header.writeUInt16LE(4, 2); // offset
    const buffers = [header];

    // Wrap everything in a menu item so the contents are a
    // valid popup menu, otherwise it doesn't display right.
    // No idea why it matters.
    addItem({ text: "root", items }, true);

    return Buffer.concat(buffers);

    function addList(items) {
        if (items.length < 1) {
            addItem({ text: "Empty", disabled: true }, true);
            return;
        }
        const startItems = items.slice();
        const lastItem = startItems.pop();
        for (const item of startItems) {
            addItem(item);
        }
        addItem(lastItem, true);
    }

    function addItem({
        id = 0,
        text = "",
        separator = false,
        disabled = false,
        checked = false,
        items,
    }, isLast = false) {
        // A variable-length structure, that must be aligned to 4-bytes.
        // struct MENUEX_TEMPLATE_ITEM {
        //    0 uint32 type;
        //    4 uint32 state;
        //    8 uint32 id;
        //   12 uint16 flags;
        //   14 utf16[...] text; // '\0' terminated
        //   ?? padding to 4-byte boundary
        //   if (items) {
        //       ?? uint32 helpid;
        //       ?? MENUEX_TEMPLATE_ITEM[...] items;
        //   }
        // }
        let size = 14 + text.length * 2 + 2;
        if (items) {
            size += 4;
        }
        if (size % 4) size += 4 - (size % 4);

        let type = 0;
        if (separator) {
            type |= 0x800;
        }
        let state = 0;
        if (disabled) {
            state |= 3;
        }
        if (checked) {
            state |= 8;
        }
        let flags = 0;
        if (isLast) {
            flags |= 0x80;
        }
        if (items) {
            flags |= 0x01;
        }

        const buffer = Buffer.alloc(size);
        buffer.writeUInt32LE(type, 0);
        buffer.writeUInt32LE(state, 4);
        buffer.writeUInt32LE(id, 8);
        buffer.writeUInt16LE(flags, 12);
        buffer.write(text, 14, 'utf16le');
        buffers.push(buffer);

        if (items) {
            addList(items);
        }
    }
}
