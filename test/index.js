const { NotifyIcon, Icon, Menu, MenuItem, MenuSeparator } = require("not-the-systray");

const icon = Icon.loadResource(Icon.small, undefined, "cmd.exe");
const altIcon = Icon.load(Icon.ids.warning, Icon.small);

const menuItemTimer = new MenuItem({
    timer: 0,
    text: "Timer: 0",
    disabled: true
});

const notifyIcon = new NotifyIcon({
    menu: new Menu([
        new MenuItem({
            text: "Checkable",
            checked: true,
            onClick: function(event){
                console.log(this.checked);
                this.update({
                    checked: !this.checked,
                });
            }
        }),
        new MenuSeparator(),
        menuItemTimer,
        new MenuSeparator(),
        new MenuItem({
            text: "Disabled",
            disabled: true
        }),
        new MenuItem({
            text: "Counter",
            count: 0,
            onClick: function(event){
                this.update({
                    text: `Counter: ${++this.count}`,
                });
            }
        }),
        new MenuSeparator(),
        new MenuItem({
            text: "Change tooltip",
            count: 0,
            onClick: function(event){
                event.notifyIcon.update({
                    tooltip: `Changed tooltip: ${++this.count}`
                });
            }
        }),
        new MenuItem({
            text: "Toogle icon",
            onClick: function(event){
                event.notifyIcon.update({
                    icon: event.notifyIcon.icon === icon ? altIcon : icon
                });
            }
        }),
        new MenuSeparator(),
        new MenuItem({
            text: "Submenu",
            subMenuItems: [
                new MenuItem({
                    text: "Submenu item",
                }),
                new MenuItem({
                    text: "Counter",
                    count: 0,
                    onClick: function(event){
                        this.update({
                            text: `Counter: ${++this.count}`,
                        });
                    }
                }),
            ]
        }),
    ]),
    icon,
    tooltip: "Example Tooltip Text",
});

setInterval(() => {
    menuItemTimer.update({
        text: `Timer: ${++menuItemTimer.timer}`,
    });
}, 1000);