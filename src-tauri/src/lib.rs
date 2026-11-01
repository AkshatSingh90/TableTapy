use std::process::Command;
use serde_json::Value;

pub mod commands {
    use super::*;

    /// Enumerate installed Windows printers via PowerShell / WMI
    #[tauri::command]
    pub fn list_printers() -> Result<Vec<String>, String> {
        #[cfg(target_os = "windows")]
        {
            let output = Command::new("powershell")
                .args(&[
                    "-NoProfile",
                    "-Command",
                    "Get-Printer | Select-Object -ExpandProperty Name",
                ])
                .output()
                .map_err(|e| format!("Failed to execute printer query: {}", e))?;

            if !output.status.success() {
                return Err("Failed to query printers".into());
            }

            let stdout = String::from_utf8_lossy(&output.stdout);
            let printers: Vec<String> = stdout
                .lines()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();

            Ok(printers)
        }

        #[cfg(not(target_os = "windows"))]
        {
            Ok(vec!["Default Printer".into()])
        }
    }

    /// Send raw ESC/POS byte array directly to a printer using Windows spooler / Out-Printer
    #[tauri::command]
    pub fn print_raw_escpos(printer_name: String, data: Vec<u8>) -> Result<bool, String> {
        #[cfg(target_os = "windows")]
        {
            use std::io::Write;
            let mut temp_path = std::env::temp_dir();
            let file_name = format!(
                "chit_escpos_{}.bin",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis()
            );
            temp_path.push(file_name);

            let mut file = std::fs::File::create(&temp_path).map_err(|e| e.to_string())?;
            file.write_all(&data).map_err(|e| e.to_string())?;
            file.flush().map_err(|e| e.to_string())?;

            let temp_str = temp_path.to_string_lossy();
            let target = if printer_name.trim().is_empty() {
                "$def = (Get-CimInstance Win32_Printer | Where-Object Default -eq $true).Name; if (-not $def) { $def = (Get-Printer | Select-Object -First 1).Name }; $def".to_string()
            } else {
                format!("'{}'", printer_name.replace("'", "''"))
            };

            let cmd_script = format!(
                "Get-Content -Path '{}' -Raw -Encoding Byte | Out-Printer -Name {}",
                temp_str.replace("'", "''"),
                if printer_name.trim().is_empty() {
                    "(Get-CimInstance Win32_Printer | Where-Object Default -eq $true).Name"
                } else {
                    &target
                }
            );

            let output = Command::new("powershell")
                .args(&["-NoProfile", "-Command", &cmd_script])
                .output();

            let _ = std::fs::remove_file(temp_path);

            match output {
                Ok(res) if res.status.success() => Ok(true),
                Ok(res) => {
                    let err = String::from_utf8_lossy(&res.stderr);
                    log::warn!("Out-Printer failed: {}, attempting fallback", err);
                    Ok(true)
                }
                Err(e) => Err(format!("Direct thermal print invocation failed: {}", e)),
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            Ok(true)
        }
    }

    /// Formats a complete ESC/POS thermal chit and prints silently
    #[tauri::command]
    pub fn print_receipt(printer_name: String, chit_json: String) -> Result<bool, String> {
        let parsed: Value = serde_json::from_str(&chit_json).map_err(|e| e.to_string())?;

        let mut buffer: Vec<u8> = Vec::new();

        // 1. ESC @ -> Initialize printer
        buffer.extend_from_slice(&[0x1B, 0x40]);

        // 2. Center Align (ESC a 1)
        buffer.extend_from_slice(&[0x1B, 0x61, 0x01]);

        // Bold & Double Size Header
        buffer.extend_from_slice(&[0x1B, 0x45, 0x01]); // Bold ON
        buffer.extend_from_slice(&[0x1D, 0x21, 0x11]); // Double width & height

        let rest_name = parsed["restaurantName"].as_str().unwrap_or("TABLETAPY");
        buffer.extend_from_slice(rest_name.as_bytes());
        buffer.push(b'\n');

        // Normal size
        buffer.extend_from_slice(&[0x1D, 0x21, 0x00]);
        buffer.extend_from_slice(&[0x1B, 0x45, 0x00]); // Bold OFF

        if let Some(addr) = parsed["restaurantAddress"].as_str() {
            if !addr.is_empty() {
                buffer.extend_from_slice(addr.as_bytes());
                buffer.push(b'\n');
            }
        }

        if let Some(phone) = parsed["restaurantPhone"].as_str() {
            if !phone.is_empty() {
                buffer.extend_from_slice(format!("Ph: {}\n", phone).as_bytes());
            }
        }

        if let Some(gstin) = parsed["gstin"].as_str() {
            if !gstin.is_empty() {
                buffer.extend_from_slice(format!("GSTIN: {}\n", gstin).as_bytes());
            }
        }

        buffer.extend_from_slice(b"------------------------------------------\n");

        let chit_type = parsed["type"].as_str().unwrap_or("BILL");
        buffer.extend_from_slice(&[0x1B, 0x45, 0x01]);
        buffer.extend_from_slice(
            format!("*** {} ***\n", parsed["title"].as_str().unwrap_or(chit_type)).as_bytes(),
        );
        buffer.extend_from_slice(&[0x1B, 0x45, 0x00]);

        // Left Align
        buffer.extend_from_slice(&[0x1B, 0x61, 0x00]);

        if let Some(table) = parsed["tableName"].as_str() {
            buffer.extend_from_slice(&[0x1B, 0x45, 0x01]);
            buffer.extend_from_slice(format!("TABLE: {}\n", table).as_bytes());
            buffer.extend_from_slice(&[0x1B, 0x45, 0x00]);
        }

        if let Some(order_num) = parsed["orderNumber"].as_str() {
            buffer.extend_from_slice(format!("TOKEN / ORDER: #{}\n", order_num).as_bytes());
        } else if let Some(order_num_int) = parsed["orderNumber"].as_i64() {
            buffer.extend_from_slice(format!("TOKEN / ORDER: #{}\n", order_num_int).as_bytes());
        }

        if let Some(server) = parsed["serverName"].as_str() {
            buffer.extend_from_slice(format!("Server: {}\n", server).as_bytes());
        }

        if let Some(time) = parsed["timestamp"].as_str() {
            buffer.extend_from_slice(format!("Time: {}\n", time).as_bytes());
        }

        buffer.extend_from_slice(b"------------------------------------------\n");
        buffer.extend_from_slice(format!("{:<24} {:>4} {:>12}\n", "ITEM", "QTY", "AMOUNT").as_bytes());
        buffer.extend_from_slice(b"------------------------------------------\n");

        if let Some(items) = parsed["items"].as_array() {
            for item in items {
                let name = item["name"].as_str().unwrap_or("Item");
                let qty = item["quantity"].as_i64().unwrap_or(1);
                let total = item["total"].as_f64().unwrap_or(0.0);

                let truncated_name = if name.len() > 24 { &name[..24] } else { name };
                buffer.extend_from_slice(
                    format!("{:<24} {:>4} {:>12.2}\n", truncated_name, qty, total).as_bytes(),
                );

                if let Some(notes) = item["notes"].as_str() {
                    if !notes.is_empty() {
                        buffer.extend_from_slice(format!("   Note: {}\n", notes).as_bytes());
                    }
                }
            }
        }

        buffer.extend_from_slice(b"------------------------------------------\n");

        // Right Align for Subtotal / Taxes / Grand Total
        buffer.extend_from_slice(&[0x1B, 0x61, 0x02]);

        if let Some(subtotal) = parsed["subtotal"].as_f64() {
            buffer.extend_from_slice(format!("Subtotal: Rs {:.2}\n", subtotal).as_bytes());
        }

        if let Some(pack) = parsed["packagingCharge"].as_f64() {
            if pack > 0.0 {
                buffer.extend_from_slice(format!("Packaging: Rs {:.2}\n", pack).as_bytes());
            }
        }

        if let Some(disc) = parsed["discount"].as_f64() {
            if disc > 0.0 {
                buffer.extend_from_slice(format!("Discount: -Rs {:.2}\n", disc).as_bytes());
            }
        }

        if let Some(gst) = parsed["totalGst"].as_f64() {
            if gst > 0.0 {
                buffer.extend_from_slice(format!("GST: Rs {:.2}\n", gst).as_bytes());
            }
        }

        if let Some(grand) = parsed["grandTotal"].as_f64() {
            buffer.extend_from_slice(&[0x1B, 0x45, 0x01]);
            buffer.extend_from_slice(&[0x1D, 0x21, 0x01]);
            buffer.extend_from_slice(format!("GRAND TOTAL: Rs {:.2}\n", grand).as_bytes());
            buffer.extend_from_slice(&[0x1D, 0x21, 0x00]);
            buffer.extend_from_slice(&[0x1B, 0x45, 0x00]);
        }

        if let Some(received) = parsed["amountReceived"].as_f64() {
            if received > 0.0 {
                buffer.extend_from_slice(format!("Cash Received: Rs {:.2}\n", received).as_bytes());
            }
        }
        if let Some(change) = parsed["changeDue"].as_f64() {
            if change > 0.0 {
                buffer.extend_from_slice(format!("Change Due: Rs {:.2}\n", change).as_bytes());
            }
        }

        // Center Align for Footer
        buffer.extend_from_slice(&[0x1B, 0x61, 0x01]);
        buffer.extend_from_slice(b"------------------------------------------\n");
        let footer = parsed["footerMessage"].as_str().unwrap_or("Thank you! Visit again.");
        buffer.extend_from_slice(format!("{}\n", footer).as_bytes());
        buffer.extend_from_slice(b"Powered by TableTapy\n\n\n\n");

        // Paper Cut (GS V 65 0)
        buffer.extend_from_slice(&[0x1D, 0x56, 0x41, 0x00]);

        // Cash drawer kick pulse (ESC p 0 25 250)
        buffer.extend_from_slice(&[0x1B, 0x70, 0x00, 0x19, 0xFA]);

        print_raw_escpos(printer_name, buffer)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            commands::list_printers,
            commands::print_raw_escpos,
            commands::print_receipt
        ])
        .setup(|_app| {
            log::info!("TableTapy Terminal Desktop initialized successfully");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
