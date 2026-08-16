"use client";

import { useEffect, useState } from "react";
import { DeviceManager, type MediaDeviceList } from "@/features/webrtc/DeviceManager";
import { Settings, X } from "lucide-react";

interface DeviceSettingsModalProps {
  deviceManager: DeviceManager;
  localStream: MediaStream | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DeviceSettingsModal({
  deviceManager,
  localStream,
  isOpen,
  onClose,
}: DeviceSettingsModalProps) {
  const [devices, setDevices] = useState<MediaDeviceList>({ videoInputs: [], audioInputs: [] });
  const [selectedVideo, setSelectedVideo] = useState<string>("");
  const [selectedAudio, setSelectedAudio] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;

    void deviceManager.enumerateDevices().then((devs) => {
      setDevices(devs);
      if (devs.videoInputs[0]) setSelectedVideo(devs.videoInputs[0].deviceId);
      if (devs.audioInputs[0]) setSelectedAudio(devs.audioInputs[0].deviceId);
    });

    deviceManager.onDeviceChange((devs) => {
      setDevices(devs);
    });

    return () => {
      deviceManager.offDeviceChange();
    };
  }, [isOpen, deviceManager]);

  if (!isOpen) return null;

  const handleVideoChange = (deviceId: string) => {
    setSelectedVideo(deviceId);
    if (localStream) {
      void deviceManager.switchCamera(deviceId, localStream);
    }
  };

  const handleAudioChange = (deviceId: string) => {
    setSelectedAudio(deviceId);
    if (localStream) {
      void deviceManager.switchMicrophone(deviceId, localStream);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-lg mb-6">
          <Settings className="w-5 h-5" />
          <span>Device Settings</span>
        </div>

        <div className="space-y-4">
          {/* Camera Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Camera</label>
            <select
              value={selectedVideo}
              onChange={(e) => handleVideoChange(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {devices.videoInputs.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera (${device.deviceId.slice(0, 8)})`}
                </option>
              ))}
            </select>
          </div>

          {/* Microphone Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Microphone</label>
            <select
              value={selectedAudio}
              onChange={(e) => handleAudioChange(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {devices.audioInputs.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone (${device.deviceId.slice(0, 8)})`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all"
        >
          Done
        </button>
      </div>
    </div>
  );
}
