#[cfg(desktop)]
mod desktop {
    use tauri::{
        menu::{Menu, MenuItem},
        tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
        webview::WebviewWindowBuilder,
        Manager, WebviewUrl,
    };

    pub fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
        let focus_item = MenuItem::with_id(app, "focus", "Focus Timer", true, None::<&str>)?;
        let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
        let menu = Menu::with_items(app, &[&focus_item, &quit_item])?;

        let _tray = TrayIconBuilder::new()
            .icon(app.default_window_icon().unwrap().clone())
            .icon_as_template(true)
            .menu(&menu)
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    toggle_focus_popup(tray.app_handle());
                }
            })
            .on_menu_event(|app, event| match event.id().as_ref() {
                "focus" => {
                    toggle_focus_popup(app);
                }
                "quit" => {
                    std::process::exit(0);
                }
                _ => {}
            })
            .build(app)?;

        Ok(())
    }

    fn toggle_focus_popup(app: &tauri::AppHandle) {
        const LABEL: &str = "focus-popup";

        if let Some(win) = app.get_webview_window(LABEL) {
            if win.is_visible().unwrap_or(false) {
                let _ = win.hide();
            } else {
                let _ = win.show();
                let _ = win.set_focus();
            }
            return;
        }

        // HashRouter: the focus screen lives under the `#` so the path
        // shape is `index.html#/app/focus`. P2 renamed /os to /app; the
        // Tauri Classic build used /os, this SaaS-aligned build uses /app.
        let _win = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("index.html#/app/focus".into()))
            .title("Focus Timer")
            .inner_size(320.0, 360.0)
            .resizable(false)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .center()
            .build();
    }
}

fn run_app() {
    // On Windows, hint WebView2 to use hardware-accelerated rendering
    #[cfg(target_os = "windows")]
    {
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "--enable-gpu-rasterization --disable-features=msSmartScreenProtection --autoplay-policy=no-user-gesture-required",
        );
    }

    let mut builder = tauri::Builder::default();

    // Register plugins
    builder = builder
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    // Updater is desktop-only — pulls signed bundles from the endpoint
    // configured in tauri.conf.json's `plugins.updater` section. Validated
    // against the pubkey embedded at build time. Mobile builds skip it
    // because Tauri Mobile doesn't have an updater story yet (P4 is a
    // fresh Expo project anyway, not a Tauri Mobile target).
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    // Desktop-only: system tray setup
    #[cfg(desktop)]
    {
        builder = builder.setup(|app| {
            desktop::setup_tray(app)?;
            Ok(())
        });
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    run_app();
}
