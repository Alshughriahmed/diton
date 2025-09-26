"use client";

type MediaState = {
  stream: MediaStream | null; 
  micOn: boolean; 
  camOn: boolean; 
  facing: "user" | "environment";
  cameras: MediaDeviceInfo[];
  currentCameraIndex: number;
};

const mediaState: MediaState = {
  stream: null,
  micOn: true,
  camOn: true,
  facing: "user",
  cameras: [],
  currentCameraIndex: 0
};

// Initialize local media stream
export async function initLocalMedia(): Promise<MediaStream> {
  if (mediaState.stream) return mediaState.stream;
  
  // Get available cameras first
  await updateAvailableCameras();
  
  const constraints: MediaStreamConstraints = {
    audio: true,
    video: {
      facingMode: mediaState.facing,
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  };
  
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  mediaState.stream = stream;
  return stream;
}

// Get current local stream
export function getLocalStream(): MediaStream | null {
  return mediaState.stream;
}

// Toggle microphone
export function toggleMic(): boolean {
  const stream = mediaState.stream;
  if (!stream) return false;
  
  mediaState.micOn = !mediaState.micOn;
  stream.getAudioTracks().forEach(track => track.enabled = mediaState.micOn);
  return mediaState.micOn;
}

// Toggle camera
export function toggleCam(): boolean {
  const stream = mediaState.stream;
  if (!stream) return false;
  
  mediaState.camOn = !mediaState.camOn;
  stream.getVideoTracks().forEach(track => track.enabled = mediaState.camOn);
  return mediaState.camOn;
}

// Get available cameras
export async function updateAvailableCameras(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    mediaState.cameras = devices.filter(device => device.kind === 'videoinput');
    return mediaState.cameras;
  } catch (error) {
    console.error('Failed to get cameras:', error);
    return [];
  }
}

// Switch to next available camera
export async function switchCamera(): Promise<MediaStream> {
  if (mediaState.cameras.length < 2) {
    // Fallback to facingMode switching for mobile
    mediaState.facing = mediaState.facing === "user" ? "environment" : "user";
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { facingMode: mediaState.facing }
    });
    
    mediaState.stream?.getTracks().forEach(track => track.stop());
    mediaState.stream = newStream;
    return newStream;
  }
  
  // Desktop: cycle through available cameras
  mediaState.currentCameraIndex = (mediaState.currentCameraIndex + 1) % mediaState.cameras.length;
  const selectedCamera = mediaState.cameras[mediaState.currentCameraIndex];
  
  const constraints: MediaStreamConstraints = {
    audio: true,
    video: {
      deviceId: { exact: selectedCamera.deviceId },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  };
  
  const newStream = await navigator.mediaDevices.getUserMedia(constraints);
  
  // Replace tracks in existing stream if available, or create new stream
  if (mediaState.stream) {
    const currentVideoTrack = mediaState.stream.getVideoTracks()[0];
    const newVideoTrack = newStream.getVideoTracks()[0];
    
    if (currentVideoTrack && newVideoTrack) {
      // Replace track for WebRTC connections
      await mediaState.stream.removeTrack(currentVideoTrack);
      currentVideoTrack.stop();
      mediaState.stream.addTrack(newVideoTrack);
      
      // Keep existing audio
      newStream.getAudioTracks().forEach(track => track.stop());
    } else {
      // Fallback: replace entire stream
      mediaState.stream.getTracks().forEach(track => track.stop());
      mediaState.stream = newStream;
    }
  } else {
    mediaState.stream = newStream;
  }
  
  return mediaState.stream;
}

// Get camera info
export function getCameraInfo(): { facing: string; available: number; current: number } {
  return {
    facing: mediaState.facing,
    available: mediaState.cameras.length,
    current: mediaState.currentCameraIndex
  };
}

// Get media state
export function getMediaState(): { micOn: boolean; camOn: boolean } {
  return {
    micOn: mediaState.micOn,
    camOn: mediaState.camOn
  };
}

// Clean up media resources
export function stopLocalMedia(): void {
  if (mediaState.stream) {
    mediaState.stream.getTracks().forEach(track => track.stop());
    mediaState.stream = null;
  }
}