const Applet = imports.ui.applet;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const Gio = imports.gi.Gio;
const Util = imports.misc.util;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const UUID = "notification-sidebar@your-name";

class NotificationSidebar extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        try {
            this.set_applet_icon_name("preferences-system");
            this.set_applet_tooltip("Open Action Center");

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this.sidebar = new St.BoxLayout({
                vertical: true,
                width: this.getSidebarWidth(),
                height: global.screen_height - 50,
                style_class: "popup-menu-content",
                x_expand: true,
                y_expand: true,
                y_align: Clutter.ActorAlign.FILL,
            });

            this.menu.box.add(this.sidebar);

            this.addTitle();
            this.addNotificationSection();
            this.addVolumeSection();
            this.addWifiSection();
            this.addPrivacyModeButton();

            this.privacyMode = false;
        } catch (e) {
            global.logError("Error loading the Notification Sidebar: " + e);
        }
    }

    getSidebarWidth() {
        return global.screen_width < 1024 ? 300 : 380;
    }

    addTitle() {
        let title = new St.Label({
            text: "Action Center",
            style_class: "popup-menu-item title",
        });
        this.sidebar.add_child(title);
    }

    addNotificationSection() {
        let notificationLabel = new St.Label({
            text: "Latest Notification:",
            style_class: "popup-menu-item notification-label",
        });
        this.sidebar.add_child(notificationLabel);

        this.notificationBox = new St.BoxLayout({
            vertical: true,
            style_class: "popup-menu-content notification-box",
        });

        this.notificationText = new St.Label({
            text: "No new notifications.",
            style_class: "popup-menu-item notification-text",
        });
        this.notificationBox.add_child(this.notificationText);
        this.sidebar.add_child(this.notificationBox);
    }

    addVolumeSection() {
        let volumeLabel = new St.Label({
            text: "Volume",
            style_class: "popup-menu-item volume-label",
        });
        this.sidebar.add_child(volumeLabel);

        this.volumeSlider = new Slider.Slider(0.5);
        this.volumeSlider.actor.set_style("padding: 10px; min-height: 30px;");
        this.volumeSlider.connect("value-changed", Lang.bind(this, this.changeVolume));
        this.sidebar.add_child(this.volumeSlider.actor);
    }

    addWifiSection() {
        let wifiLabel = new St.Label({
            text: "Available Wi-Fi Networks",
            style_class: "popup-menu-item wifi-label",
        });
        this.sidebar.add_child(wifiLabel);

        // Adiciona um ScrollView para a lista de redes Wi-Fi
        this.wifiScroll = new St.ScrollView({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            style_class: "popup-menu-content wifi-scroll",
        });

        this.wifiBox = new St.BoxLayout({
            vertical: true,
            style_class: "popup-menu-content wifi-box",
        });

        this.wifiScroll.add_actor(this.wifiBox);
        this.sidebar.add_child(this.wifiScroll);

        this.updateWifiList();

        let refreshButton = new St.Button({
            label: "Refresh Networks",
            style_class: "popup-menu-item refresh-button",
        });
        refreshButton.connect("clicked", () => this.updateWifiList());
        this.sidebar.add_child(refreshButton);

        let networkButton = new St.Button({
            label: "Open Network Settings",
            style_class: "popup-menu-item network-button",
        });
        networkButton.connect("clicked", () => Util.spawnCommandLine("nm-connection-editor"));
        this.sidebar.add_child(networkButton);
    }

    addPrivacyModeButton() {
        this.privacyModeButton = new St.Button({
            label: "Privacy Mode: Disabled",
            style_class: "popup-menu-item privacy-button",
        });
        this.privacyModeButton.connect("clicked", Lang.bind(this, this.togglePrivacyMode));
        this.sidebar.add_child(this.privacyModeButton);
    }

    on_applet_clicked() {
        this.menu.toggle();
    }

    changeVolume(slider, value) {
        let volume = Math.round(value * 100);
        Util.spawnCommandLine(`pactl set-sink-volume @DEFAULT_SINK@ ${volume}%`);
    }

    updateWifiList() {
        this.wifiBox.destroy_all_children();

        if (this.privacyMode) {
            let privacyLabel = new St.Label({
                text: "Wi-Fi networks are hidden in Privacy Mode.",
                style_class: "popup-menu-item wifi-privacy-label",
            });
            this.wifiBox.add_child(privacyLabel);
        } else {
            let [ok, out] = GLib.spawn_command_line_sync("nmcli -t -f SSID dev wifi");
            if (!ok) return;

            let networks = out.toString().split("\n").filter(ssid => ssid.trim() !== "");

            if (networks.length === 0) {
                let noWifiLabel = new St.Label({
                    text: "No networks found.",
                    style_class: "popup-menu-item wifi-no-networks",
                });
                this.wifiBox.add_child(noWifiLabel);
            } else {
                networks.forEach(ssid => {
                    let wifiButton = new St.Button({
                        label: ssid,
                        style_class: "popup-menu-item wifi-button",
                    });
                    wifiButton.connect("clicked", () => {
                        Util.spawnCommandLine(`nmcli dev wifi connect "${ssid}"`);
                    });
                    this.wifiBox.add_child(wifiButton);
                });
            }
        }
    }

    togglePrivacyMode() {
        this.privacyMode = !this.privacyMode;
        this.privacyModeButton.set_label(this.privacyMode ? "Privacy Mode: Enabled" : "Privacy Mode: Disabled");
        this.updateWifiList();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new NotificationSidebar(metadata, orientation, panelHeight, instanceId);
}
