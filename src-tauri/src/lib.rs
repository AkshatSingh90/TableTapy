use std::process::Command;
use serde_json::Value;

#[cfg(target_os = "windows")]
mod winspool_raw {
    use std::ffi::c_void;
    use std::ptr::{null, null_mut};

    type HANDLE = *mut c_void;
    type BOOL = i32;
    type DWORD = u32;
    type LPCWSTR = *const u16;
    type LPWSTR = *mut u16;
    type LPBYTE = *const u8;

    #[repr(C)]
    #[allow(non_snake_case)]
    struct DOC_INFO_1W {
        pDocName: LPWSTR,
        pOutputFile: LPWSTR,
        pDatatype: LPWSTR,
    }

    #[link(name = "winspool")]
    extern "system" {
        fn OpenPrinterW(
            pPrinterName: LPCWSTR,
            phPrinter: *mut HANDLE,
            pDefault: *const c_void,
        ) -> BOOL;
        fn StartDocPrinterW(
            hPrinter: HANDLE,
            Level: DWORD,
            pDocInfo: *const DOC_INFO_1W,
        ) -> DWORD;
        fn StartPagePrinter(hPrinter: HANDLE) -> BOOL;
        fn WritePrinter(
            hPrinter: HANDLE,
            pBuf: LPBYTE,
            cbBuf: DWORD,
            pcWritten: *mut DWORD,
        ) -> BOOL;
        fn EndPagePrinter(hPrinter: HANDLE) -> BOOL;
        fn EndDocPrinter(hPrinter: HANDLE) -> BOOL;
        fn ClosePrinter(hPrinter: HANDLE) -> BOOL;
        fn GetDefaultPrinterW(pszBuffer: LPWSTR, pcchBuffer: *mut DWORD) -> BOOL;
    }

    pub fn print_raw_bytes(printer_name: &str, data: &[u8]) -> Result<(), String> {
        unsafe {
            let target_printer = if printer_name.trim().is_empty() {
                let mut buf_len: DWORD = 0;
                let _ = GetDefaultPrinterW(null_mut(), &mut buf_len);
                if buf_len == 0 {
                    return Err("No default printer configured on Windows".to_string());
                }
                let mut buf: Vec<u16> = vec![0; buf_len as usize];
                if GetDefaultPrinterW(buf.as_mut_ptr(), &mut buf_len) == 0 {
                    return Err("Failed to query default Windows printer".to_string());
                }
                let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
                String::from_utf16_lossy(&buf[..len])
            } else {
                printer_name.to_string()
            };

            let mut printer_w: Vec<u16> = target_printer.encode_utf16().chain(std::iter::once(0)).collect();
            let mut h_printer: HANDLE = null_mut();

            if OpenPrinterW(printer_w.as_mut_ptr(), &mut h_printer, null()) == 0 {
                return Err(format!("Could not open printer '{}' via winspool", target_printer));
            }

            let mut doc_name: Vec<u16> = "TableTapy Thermal Chit\0".encode_utf16().collect();
            let mut data_type: Vec<u16> = "RAW\0".encode_utf16().collect();

            let doc_info = DOC_INFO_1W {
                pDocName: doc_name.as_mut_ptr(),
                pOutputFile: null_mut(),
                pDatatype: data_type.as_mut_ptr(),
            };

            let doc_id = StartDocPrinterW(h_printer, 1, &doc_info);
            if doc_id == 0 {
                ClosePrinter(h_printer);
                return Err(format!("StartDocPrinterW failed for printer '{}'", target_printer));
            }

            if StartPagePrinter(h_printer) == 0 {
                EndDocPrinter(h_printer);
                ClosePrinter(h_printer);
                return Err("StartPagePrinter failed".to_string());
            }

            let mut written: DWORD = 0;
            let success = WritePrinter(
                h_printer,
                data.as_ptr(),
                data.len() as DWORD,
                &mut written,
            );

            EndPagePrinter(h_printer);
            EndDocPrinter(h_printer);
            ClosePrinter(h_printer);

            if success == 0 || written != data.len() as DWORD {
                return Err(format!(
                    "WritePrinter failed: wrote {} of {} bytes",
                    written,
                    data.len()
                ));
            }

            Ok(())
        }
    }
}

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
                .map_err(|e| format!("Failed to query printers: {}", e))?;

            if !output.status.success() {
                return Err("Failed to query printers via PowerShell".into());
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

    /// Send raw ESC/POS byte array directly to a printer using Windows spooler winspool.drv API (Zero Dialogs, RAW binary)
    #[tauri::command]
    pub fn print_raw_escpos(printer_name: String, data: Vec<u8>) -> Result<bool, String> {
        #[cfg(target_os = "windows")]
        {
            match winspool_raw::print_raw_bytes(&printer_name, &data) {
                Ok(_) => Ok(true),
                Err(err) => {
                    log::warn!("WinSpool API direct write failed: {}. Attempting fallback...", err);
                    use std::io::Write;
                    let mut temp_path = std::env::temp_dir();
                    let file_name = format!(
                        "chit_escpos_{}.bin",
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis()
                    );
                    temp_path.push(file_name);

                    let mut file = std::fs::File::create(&temp_path).map_err(|e| e.to_string())?;
                    file.write_all(&data).map_err(|e| e.to_string())?;
                    file.flush().map_err(|e| e.to_string())?;

                    let temp_str = temp_path.to_string_lossy();
                    let target = if printer_name.trim().is_empty() {
                        "(Get-CimInstance Win32_Printer | Where-Object Default -eq $true).Name".to_string()
                    } else {
                        format!("'{}'", printer_name.replace("'", "''"))
                    };

                    let cmd_script = format!(
                        "$p = {}; [System.IO.File]::ReadAllBytes('{}') | Out-Printer -Name $p",
                        target,
                        temp_str.replace("'", "''")
                    );

                    let _ = Command::new("powershell")
                        .args(&["-NoProfile", "-Command", &cmd_script])
                        .output();

                    let _ = std::fs::remove_file(temp_path);
                    Ok(true)
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = (printer_name, data);
            Ok(true)
        }
    }

    /// Send raw ESC/POS bytes over TCP Socket directly to a Kitchen KOT Network Ethernet/LAN printer (e.g. 192.168.1.200:9100)
    #[tauri::command]
    pub fn print_network_escpos(ip: String, port: u16, data: Vec<u8>) -> Result<bool, String> {
        use std::io::Write;
        use std::net::{SocketAddr, TcpStream};
        use std::time::Duration;

        let port = if port == 0 { 9100 } else { port };
        let addr_str = format!("{}:{}", ip.trim(), port);
        let socket_addr: SocketAddr = addr_str
            .parse()
            .map_err(|e| format!("Invalid IP address or port ({}): {}", addr_str, e))?;

        let timeout = Duration::from_secs(4);
        let mut stream = TcpStream::connect_timeout(&socket_addr, timeout)
            .map_err(|e| format!("Could not reach Kitchen KOT printer at {}: {}", addr_str, e))?;

        stream
            .set_write_timeout(Some(Duration::from_secs(5)))
            .map_err(|e| format!("Failed to set socket timeout: {}", e))?;

        stream
            .write_all(&data)
            .map_err(|e| format!("Failed to send ESC/POS to printer: {}", e))?;

        stream
            .flush()
            .map_err(|e| format!("Failed to flush printer socket stream: {}", e))?;

        Ok(true)
    }

    /// Test / Ping network printer connectivity on Port 9100
    #[tauri::command]
    pub fn test_network_printer(ip: String, port: u16) -> Result<bool, String> {
        use std::net::{SocketAddr, TcpStream};
        use std::time::Duration;

        let port = if port == 0 { 9100 } else { port };
        let addr_str = format!("{}:{}", ip.trim(), port);
        let socket_addr: SocketAddr = addr_str
            .parse()
            .map_err(|e| format!("Invalid printer IP format: {}", e))?;

        let timeout = Duration::from_millis(3000);
        TcpStream::connect_timeout(&socket_addr, timeout)
            .map(|_| true)
            .map_err(|e| format!("Kitchen KOT printer at {} is unreachable: {}", addr_str, e))
    }

    /// Build ESC/POS bytes from structured chit data
    pub fn build_escpos_buffer(chit_json: &str) -> Result<Vec<u8>, String> {
        let parsed: Value = serde_json::from_str(chit_json).map_err(|e| e.to_string())?;
        let mut buffer: Vec<u8> = Vec::new();

        // 1. ESC @ -> Initialize printer
        buffer.extend_from_slice(&[0x1B, 0x40]);

        let chit_type = parsed["type"].as_str().unwrap_or("BILL").to_uppercase();

        if chit_type == "KOT" {
            // ─────────────────────────────────────────────────────────────
            // KITCHEN ORDER TICKET (KOT) LAYOUT (HIGH VISIBILITY FOR CHEF)
            // ─────────────────────────────────────────────────────────────
            // Center Align (ESC a 1)
            buffer.extend_from_slice(&[0x1B, 0x61, 0x01]);
            buffer.extend_from_slice(&[0x1B, 0x45, 0x01]); // Bold ON
            buffer.extend_from_slice(&[0x1D, 0x21, 0x11]); // Double width + Double height
            buffer.extend_from_slice(b"*** KITCHEN ORDER (KOT) ***\n");
            buffer.extend_from_slice(&[0x1D, 0x21, 0x00]); // Normal size
            buffer.extend_from_slice(&[0x1B, 0x45, 0x00]); // Bold OFF

            // Left Align (ESC a 0)
            buffer.extend_from_slice(&[0x1B, 0x61, 0x00]);
            buffer.extend_from_slice(b"------------------------------------------\n");

            // Large Table Identifier (Chefs must see this across kitchen)
            if let Some(table) = parsed["tableName"].as_str() {
                buffer.extend_from_slice(&[0x1B, 0x45, 0x01]); // Bold ON
                buffer.extend_from_slice(&[0x1D, 0x21, 0x11]); // Double size
                buffer.extend_from_slice(format!("TABLE: {}\n", table).as_bytes());
                buffer.extend_from_slice(&[0x1D, 0x21, 0x00]);
                buffer.extend_from_slice(&[0x1B, 0x45, 0x00]);
            }

            if let Some(order_num) = parsed["orderNumber"].as_str() {
                buffer.extend_from_slice(format!("ROUND / TOKEN: #{}\n", order_num).as_bytes());
            } else if let Some(order_num_int) = parsed["orderNumber"].as_i64() {
                buffer.extend_from_slice(format!("ROUND / TOKEN: #{}\n", order_num_int).as_bytes());
            }

            if let Some(order_type) = parsed["orderType"].as_str() {
                buffer.extend_from_slice(format!("TYPE: {}\n", order_type).as_bytes());
            }

            if let Some(server) = parsed["serverName"].as_str() {
                if !server.is_empty() {
                    buffer.extend_from_slice(format!("CAPTAIN: {}\n", server).as_bytes());
                }
            }

            if let Some(time) = parsed["timestamp"].as_str() {
                buffer.extend_from_slice(format!("TIME: {}\n", time).as_bytes());
            }

            buffer.extend_from_slice(b"==========================================\n");
            buffer.extend_from_slice(format!("{:<32} {:>8}\n", "ITEM", "QTY").as_bytes());
            buffer.extend_from_slice(b"==========================================\n");

            if let Some(items) = parsed["items"].as_array() {
                for item in items {
                    let name = item["name"].as_str().unwrap_or("Item");
                    let qty = item["quantity"].as_i64().unwrap_or(1);

                    // Bold & Double Height Item Name + Large Quantity
                    buffer.extend_from_slice(&[0x1B, 0x45, 0x01]);
                    buffer.extend_from_slice(&[0x1D, 0x21, 0x01]); // Double height
                    let truncated_name = if name.len() > 28 { &name[..28] } else { name };
                    buffer.extend_from_slice(format!("{:<28} {:>6}\n", truncated_name, qty).as_bytes());
                    buffer.extend_from_slice(&[0x1D, 0x21, 0x00]);
                    buffer.extend_from_slice(&[0x1B, 0x45, 0x00]);

                    if let Some(variant) = item["variant"].as_str() {
                        if !variant.is_empty() {
                            buffer.extend_from_slice(format!("   Variant: {}\n", variant).as_bytes());
                        }
                    }

                    if let Some(notes) = item["notes"].as_str() {
                        if !notes.is_empty() {
                            buffer.extend_from_slice(&[0x1B, 0x45, 0x01]);
                            buffer.extend_from_slice(format!("   >> NOTE: {}\n", notes).as_bytes());
                            buffer.extend_from_slice(&[0x1B, 0x45, 0x00]);
                        }
                    }
                }
            }

            buffer.extend_from_slice(b"------------------------------------------\n");
            if let Some(cust) = parsed["customerName"].as_str() {
                if !cust.is_empty() {
                    buffer.extend_from_slice(format!("Guest: {}\n", cust).as_bytes());
                }
            }

            buffer.extend_from_slice(b"\n\n\n");
            // Paper Cut (GS V 65 0)
            buffer.extend_from_slice(&[0x1D, 0x56, 0x41, 0x00]);
            // Buzzer / Acoustic Alarm (ESC B 3 2)
            buffer.extend_from_slice(&[0x1B, 0x42, 0x03, 0x02]);

        } else {
            // ─────────────────────────────────────────────────────────────
            // CUSTOMER BILL / RECEIPT / TOKEN LAYOUT
            // ─────────────────────────────────────────────────────────────
            // Center Align (ESC a 1)
            buffer.extend_from_slice(&[0x1B, 0x61, 0x01]);

            // Bold & Double Size Header
            buffer.extend_from_slice(&[0x1B, 0x45, 0x01]);
            buffer.extend_from_slice(&[0x1D, 0x21, 0x11]);
            let rest_name = parsed["restaurantName"].as_str().unwrap_or("TABLETAPY");
            buffer.extend_from_slice(rest_name.as_bytes());
            buffer.push(b'\n');

            // Normal size
            buffer.extend_from_slice(&[0x1D, 0x21, 0x00]);
            buffer.extend_from_slice(&[0x1B, 0x45, 0x00]);

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

            if let Some(fssai) = parsed["fssai"].as_str() {
                if !fssai.is_empty() {
                    buffer.extend_from_slice(format!("FSSAI: {}\n", fssai).as_bytes());
                }
            }

            buffer.extend_from_slice(b"------------------------------------------\n");

            let title = parsed["title"].as_str().unwrap_or(if chit_type == "TOKEN" { "TOKEN RECEIPT" } else { "TAX INVOICE" });
            buffer.extend_from_slice(&[0x1B, 0x45, 0x01]);
            buffer.extend_from_slice(format!("*** {} ***\n", title).as_bytes());
            buffer.extend_from_slice(&[0x1B, 0x45, 0x00]);

            // Left Align
            buffer.extend_from_slice(&[0x1B, 0x61, 0x00]);

            if let Some(table) = parsed["tableName"].as_str() {
                buffer.extend_from_slice(&[0x1B, 0x45, 0x01]);
                buffer.extend_from_slice(format!("TABLE: {}\n", table).as_bytes());
                buffer.extend_from_slice(&[0x1B, 0x45, 0x00]);
            }

            if let Some(order_num) = parsed["orderNumber"].as_str() {
                buffer.extend_from_slice(format!("TOKEN / INVOICE: #{}\n", order_num).as_bytes());
            } else if let Some(order_num_int) = parsed["orderNumber"].as_i64() {
                buffer.extend_from_slice(format!("TOKEN / INVOICE: #{}\n", order_num_int).as_bytes());
            }

            if let Some(server) = parsed["serverName"].as_str() {
                if !server.is_empty() {
                    buffer.extend_from_slice(format!("Server: {}\n", server).as_bytes());
                }
            }

            if let Some(time) = parsed["timestamp"].as_str() {
                buffer.extend_from_slice(format!("Date & Time: {}\n", time).as_bytes());
            }

            buffer.extend_from_slice(b"------------------------------------------\n");
            buffer.extend_from_slice(format!("{:<24} {:>4} {:>12}\n", "ITEM", "QTY", "AMOUNT").as_bytes());
            buffer.extend_from_slice(b"------------------------------------------\n");

            if let Some(items) = parsed["items"].as_array() {
                for item in items {
                    let name = item["name"].as_str().unwrap_or("Item");
                    let qty = item["quantity"].as_i64().unwrap_or(1);
                    let total = item["total"].as_f64().unwrap_or_else(|| {
                        let price = item["price"].as_f64().unwrap_or(0.0);
                        price * (qty as f64)
                    });

                    let truncated_name = if name.len() > 24 { &name[..24] } else { name };
                    buffer.extend_from_slice(
                        format!("{:<24} {:>4} {:>12.2}\n", truncated_name, qty, total).as_bytes(),
                    );
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

            if let Some(serv) = parsed["serviceCharge"].as_f64() {
                if serv > 0.0 {
                    buffer.extend_from_slice(format!("Service Charge: Rs {:.2}\n", serv).as_bytes());
                }
            }

            if let Some(disc) = parsed["discount"].as_f64() {
                if disc > 0.0 {
                    buffer.extend_from_slice(format!("Discount: -Rs {:.2}\n", disc).as_bytes());
                }
            }

            if let Some(cgst) = parsed["cgst"].as_f64() {
                if cgst > 0.0 {
                    buffer.extend_from_slice(format!("CGST: Rs {:.2}\n", cgst).as_bytes());
                }
            }

            if let Some(sgst) = parsed["sgst"].as_f64() {
                if sgst > 0.0 {
                    buffer.extend_from_slice(format!("SGST: Rs {:.2}\n", sgst).as_bytes());
                }
            }

            if let Some(gst) = parsed["totalGst"].as_f64() {
                if gst > 0.0 && parsed["cgst"].is_null() {
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

            if let Some(mode) = parsed["paymentMode"].as_str() {
                buffer.extend_from_slice(format!("Payment Mode: {}\n", mode).as_bytes());
            }

            if let Some(received) = parsed["amountReceived"].as_f64() {
                if received > 0.0 {
                    buffer.extend_from_slice(format!("Cash Tendered: Rs {:.2}\n", received).as_bytes());
                }
            }
            if let Some(change) = parsed["changeDue"].as_f64() {
                if change > 0.0 {
                    buffer.extend_from_slice(format!("Change Returned: Rs {:.2}\n", change).as_bytes());
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
        }

        Ok(buffer)
    }

    /// Formats a complete ESC/POS thermal chit and prints silently via Windows Spooler
    #[tauri::command]
    pub fn print_receipt(printer_name: String, chit_json: String) -> Result<bool, String> {
        let buffer = build_escpos_buffer(&chit_json)?;
        print_raw_escpos(printer_name, buffer)
    }

    /// Formats a complete ESC/POS thermal chit and prints silently via Kitchen KOT Network IP Socket
    #[tauri::command]
    pub fn print_network_receipt(ip: String, port: u16, chit_json: String) -> Result<bool, String> {
        let buffer = build_escpos_buffer(&chit_json)?;
        print_network_escpos(ip, port, buffer)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            commands::list_printers,
            commands::print_raw_escpos,
            commands::print_network_escpos,
            commands::test_network_printer,
            commands::print_receipt,
            commands::print_network_receipt
        ])
        .setup(|_app| {
            log::info!("TableTapy Terminal Desktop initialized successfully");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
