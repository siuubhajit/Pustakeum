import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HardDrive, X, RefreshCw, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { BookView } from "../../state/useLibraryStore";

interface EreaderDevice {
  id: string;
  name: string;
  model: string;
  mount_path: string;
  storage_free_mb: number;
  storage_total_mb: number;
  book_count: number;
  supported_formats: string[];
}

interface DeviceSyncProgress {
  device_id: string;
  synced_count: number;
  failed_count: number;
  messages: string[];
  is_complete: boolean;
}

interface DeviceManagerModalProps {
  books: BookView[];
  onClose: () => void;
}

export const DeviceManagerModal: React.FC<DeviceManagerModalProps> = ({
  books,
  onClose,
}) => {
  const [devices, setDevices] = useState<EreaderDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [selectedBookIds, setSelectedBookIds] = useState<number[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<DeviceSyncProgress | null>(null);

  const scanDevices = async () => {
    setIsScanning(true);
    try {
      const devList: EreaderDevice[] = await invoke("cmd_mtp_list_devices");
      setDevices(devList);
      if (devList.length > 0 && !selectedDevice) {
        setSelectedDevice(devList[0].id);
      }
    } catch (err) {
      console.warn("Device scan error:", err);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    scanDevices();
    // Default select all books in library
    setSelectedBookIds(books.map((b) => b.id));
  }, [books]);

  const handleSyncToDevice = async () => {
    if (!selectedDevice || selectedBookIds.length === 0) return;
    setIsSyncing(true);
    setSyncProgress(null);

    try {
      const progress: DeviceSyncProgress = await invoke("cmd_sync_to_device", {
        deviceId: selectedDevice,
        bookIds: selectedBookIds,
      });
      setSyncProgress(progress);
    } catch (err) {
      console.warn("Device sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleSelectBook = (id: number) => {
    setSelectedBookIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const activeDev = devices.find((d) => d.id === selectedDevice);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 120,
      }}
    >
      <div
        style={{
          backgroundColor: "#161B22",
          color: "#E2E8F0",
          border: "1px solid #30363D",
          borderRadius: 10,
          width: 760,
          maxWidth: "92vw",
          height: 540,
          boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            borderBottom: "1px solid #30363D",
            background: "#0D1117",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <HardDrive size={22} color="#E5A93C" />
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>
                USB & MTP E-Reader Hardware Manager
              </div>
              <div style={{ fontSize: 12, color: "#8B949E" }}>
                Kindle • Kobo (.kepub conversion) • Onyx Boox • Nook
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={scanDevices}
              disabled={isScanning}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                background: "#21262D",
                color: "#E2E8F0",
                border: "1px solid #30363D",
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={13} className={isScanning ? "animate-spin" : ""} />
              {isScanning ? "Scanning..." : "Rescan Devices"}
            </button>

            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "#8B949E",
                cursor: "pointer",
                padding: 4,
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body: Split between Devices & Books */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left: Device Selection & Storage Stats */}
          <div
            style={{
              width: 280,
              borderRight: "1px solid #30363D",
              padding: 16,
              background: "#0D1117",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "#8B949E" }}>
              DETECTED HARDWARE
            </div>

            {devices.map((dev) => {
              const usedMb = dev.storage_total_mb - dev.storage_free_mb;
              const usedPct = Math.round((usedMb / dev.storage_total_mb) * 100);

              return (
                <div
                  key={dev.id}
                  onClick={() => setSelectedDevice(dev.id)}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: selectedDevice === dev.id ? "#1C2128" : "#161B22",
                    border: `1px solid ${
                      selectedDevice === dev.id ? "#E5A93C" : "#30363D"
                    }`,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{dev.name}</div>
                  <div style={{ fontSize: 11, color: "#8B949E" }}>
                    Mount: {dev.mount_path}
                  </div>

                  {/* Storage Bar */}
                  <div style={{ marginTop: 4 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 10,
                        color: "#8B949E",
                        marginBottom: 3,
                      }}
                    >
                      <span>
                        {(dev.storage_free_mb / 1024).toFixed(1)} GB Free
                      </span>
                      <span>{usedPct}% Used</span>
                    </div>
                    <div
                      style={{
                        width: "100%",
                        height: 5,
                        background: "#30363D",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${usedPct}%`,
                          height: "100%",
                          background: "#E5A93C",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Books Selection & Sync Progress */}
          <div
            style={{
              flex: 1,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                Select Books to Sync ({selectedBookIds.length}/{books.length})
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setSelectedBookIds(books.map((b) => b.id))}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#58A6FF",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedBookIds([])}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#8B949E",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Books List */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                border: "1px solid #30363D",
                borderRadius: 6,
                background: "#0D1117",
              }}
            >
              {books.map((b) => (
                <div
                  key={b.id}
                  onClick={() => toggleSelectBook(b.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderBottom: "1px solid #21262D",
                    cursor: "pointer",
                    background: selectedBookIds.includes(b.id)
                      ? "rgba(229, 169, 60, 0.08)"
                      : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedBookIds.includes(b.id)}
                    onChange={() => {}}
                  />
                  <div style={{ flex: 1, fontSize: 13 }}>{b.title}</div>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: "#21262D",
                      color: "#8B949E",
                    }}
                  >
                    {b.file_format}
                  </span>
                </div>
              ))}
            </div>

            {/* Sync Progress Log */}
            {syncProgress && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  background: "#0D1117",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "#3FB950",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <CheckCircle2 size={16} />
                <span>
                  Successfully transferred {syncProgress.synced_count} books to{" "}
                  {activeDev?.name || "device"}!
                </span>
              </div>
            )}

            {/* Footer Action Bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 12,
                marginTop: 16,
              }}
            >
              <button
                onClick={onClose}
                style={{
                  padding: "8px 16px",
                  background: "#21262D",
                  color: "#E2E8F0",
                  border: "1px solid #30363D",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleSyncToDevice}
                disabled={isSyncing || selectedBookIds.length === 0}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 20px",
                  background: "#E5A93C",
                  color: "#161B22",
                  fontWeight: 600,
                  border: "none",
                  borderRadius: 6,
                  cursor:
                    isSyncing || selectedBookIds.length === 0
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                <Send size={15} />
                {isSyncing ? "Transferring Books..." : "Sync to Hardware"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

