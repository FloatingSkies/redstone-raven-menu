const Applet = imports.ui.applet;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const Gio = imports.gi.Gio;
const Util = imports.misc.util;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;

const UUID = "redstone-raven-menu@floatingskies";

class NotificationSidebar extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        try {
            this.set_applet_icon_name("preferences-system");
            this.set_applet_tooltip("Open Action Center");

            this.isPrivacyModeActive = false;
            this.notifications = [];

            let sidebar = new St.BoxLayout({
                vertical: true,
                width: 380,
                height: global.screen_height - 50,
                style_class: "popup-menu-content",
                x_expand: true,
                y_expand: true,
                y_align: Clutter.ActorAlign.FILL,
            });

            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menu.box.add(sidebar);

            let title = new St.Label({
                text: "Action Center",
                style_class: "popup-menu-item",
            });
            sidebar.add_child(title);

            this.notificationBox = new St.BoxLayout({
                vertical: true,
                style_class: "popup-menu-content",
                style: "padding: 10px;",
            });
            sidebar.add_child(this.notificationBox);

            let clearNotificationsButton = new St.Button({
                label: "Clear Notifications",
                style_class: "popup-menu-item button-background",
            });
            clearNotificationsButton.connect("clicked", () => {
                this.clearNotifications();
            });
            sidebar.add_child(clearNotificationsButton);

            let volumeLabel = new St.Label({
                text: "Volume",
                style_class: "popup-menu-item",
            });
            this.volumeSlider = new Slider.Slider(0.5);
            this.volumeSlider.actor.set_style("padding: 10px; min-height: 20px;");
            this.volumeSlider.connect("value-changed", (_, value) => this.changeVolume(value));

            sidebar.add_child(volumeLabel);
            sidebar.add_child(this.volumeSlider.actor);

            let wifiLabel = new St.Label({
                text: "Available Wi-Fi Networks",
                style_class: "popup-menu-item",
            });
            sidebar.add_child(wifiLabel);

            this.wifiBox = new St.BoxLayout({
                vertical: true,
                style_class: "popup-menu-content",
                style: "padding: 10px; border-radius: 8px;",
            });
            sidebar.add_child(this.wifiBox);

            let privacyButton = new St.Button({
                label: "Enable Privacy Mode",
                style_class: "popup-menu-item button-background",
            });
            privacyButton.connect("clicked", () => this.togglePrivacyMode(privacyButton));
            sidebar.add_child(privacyButton);

            this.updateWifiList();
            this.listenForNotifications();

            let refreshButton = new St.Button({
                label: "Refresh Networks",
                style_class: "popup-menu-item button-background",
            });
            refreshButton.connect("clicked", () => this.updateWifiList());
            sidebar.add_child(refreshButton);

            let networkButton = new St.Button({
                label: "Open Network Settings",
                style_class: "popup-menu-item button-background",
            });
            networkButton.connect("clicked", () => Util.spawnCommandLine("nm-connection-editor"));
            sidebar.add_child(networkButton);
        } catch (e) {
            global.logError("Error loading Notification Sidebar: " + e);
        }
    }

    on_applet_clicked() {
        this.menu.toggle();
    }

    changeVolume(value) {
        let volume = Math.round(value * 100);
        Util.spawnCommandLine(`pactl set-sink-volume @DEFAULT_SINK@ ${volume}%`);
    }

    updateWifiList() {
        this.wifiBox.destroy_all_children();

        if (this.isPrivacyModeActive) {
            this.wifiBox.add_child(new St.Label({ text: "Wi-Fi networks are hidden.", style_class: "popup-menu-item" }));
            return;
        }

        let [ok, out] = GLib.spawn_command_line_sync("nmcli -t -f SSID dev wifi");
        if (!ok) return;

        let networks = out.toString().split("\n").filter(ssid => ssid.trim() !== "");
        networks.forEach(ssid => {
            let wifiButton = new St.Button({ label: ssid, style_class: "popup-menu-item button-background" });
            wifiButton.connect("clicked", () => Util.spawnCommandLine(`nmcli dev wifi connect "${ssid}"`));
            this.wifiBox.add_child(wifiButton);
        });
    }

    togglePrivacyMode(button) {
        this.isPrivacyModeActive = !this.isPrivacyModeActive;
        button.label = this.isPrivacyModeActive ? "Disable Privacy Mode" : "Enable Privacy Mode";
        this.updateWifiList();
    }

    listenForNotifications() {
        Gio.DBus.session.signal_subscribe(
            null,
            "org.freedesktop.Notifications",
            "Notify",
            null,
            null,
            Gio.DBusSignalFlags.NONE,
            (_, sender, path, iface, signal, params) => {
                let notificationData = params.deep_unpack();
                let summary = notificationData[3];
                let body = notificationData[4] || "";
                this.notifications.push(`${summary}: ${body}`);
                this.refreshNotificationBox();
            }
        );
    }

    refreshNotificationBox() {
        this.notificationBox.destroy_all_children();

        if (this.notifications.length === 0) {
            this.notificationBox.add_child(new St.Label({ text: "No new notifications.", style_class: "popup-menu-item" }));
        } else {
            this.notifications.slice(-5).forEach(notification => {
                this.notificationBox.add_child(new St.Label({ text: notification, style_class: "popup-menu-item" }));
            });
        }
    }

    clearNotifications() {
        this.notifications = [];
        this.refreshNotificationBox();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new NotificationSidebar(metadata, orientation, panelHeight, instanceId);
}

