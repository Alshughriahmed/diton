"use client";

import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { FACEMESH_TESSELATION, FACEMESH_RIGHT_EYE, FACEMESH_LEFT_EYE } from "@mediapipe/face_mesh";

export interface EffectConfig {
  beauty: {
    enabled: boolean;
    smoothing: number; // 0-1
    brightening: number; // 0-1
    eyeEnlargement: number; // 0-1
    slimming: number; // 0-1
  };
  mask: {
    enabled: boolean;
    type: 'cat' | 'dog' | 'bunny' | 'robot' | 'none';
  };
}

class VideoEffects {
  private faceMesh: FaceMesh | null = null;
  private camera: Camera | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private video: HTMLVideoElement | null = null;
  private outputStream: MediaStream | null = null;
  private isProcessing = false;
  
  private config: EffectConfig = {
    beauty: {
      enabled: false,
      smoothing: 0.3,
      brightening: 0.2,
      eyeEnlargement: 0.1,
      slimming: 0.1,
    },
    mask: {
      enabled: false,
      type: 'none',
    }
  };

  constructor() {
    this.initializeFaceMesh();
  }

  private async initializeFaceMesh() {
    try {
      this.faceMesh = new FaceMesh({
        locateFile: (file: string) => 
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      });

      this.faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.faceMesh.onResults((results) => {
        this.onResults(results);
      });
    } catch (error) {
      console.error('Failed to initialize FaceMesh:', error);
    }
  }

  public async initialize(videoElement: HTMLVideoElement): Promise<MediaStream | null> {
    try {
      this.video = videoElement;
      
      // Create canvas for processing
      this.canvas = document.createElement('canvas');
      this.canvas.width = 640;
      this.canvas.height = 480;
      this.ctx = this.canvas.getContext('2d');
      
      if (!this.ctx) {
        throw new Error('Failed to get canvas context');
      }

      // Setup camera
      if (this.faceMesh) {
        this.camera = new Camera(videoElement, {
          onFrame: async () => {
            if (this.isProcessing) return;
            this.isProcessing = true;
            await this.faceMesh!.send({ image: videoElement });
            this.isProcessing = false;
          },
          width: 640,
          height: 480,
        });
      }

      // Create output stream from canvas
      this.outputStream = this.canvas.captureStream(30);
      
      return this.outputStream;
    } catch (error) {
      console.error('Failed to initialize effects:', error);
      return null;
    }
  }

  private onResults(results: any) {
    if (!this.ctx || !this.canvas) return;

    const { ctx, canvas } = this;
    
    // Clear canvas
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw original image
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0];
      
      // Apply beauty effects
      if (this.config.beauty.enabled) {
        this.applyBeautyEffects(ctx, landmarks, canvas.width, canvas.height);
      }
      
      // Apply mask
      if (this.config.mask.enabled && this.config.mask.type !== 'none') {
        this.applyMask(ctx, landmarks, canvas.width, canvas.height);
      }
      
      // Debug: Draw face landmarks (remove in production)
      if (process.env.NODE_ENV === 'development') {
        this.drawDebugLandmarks(ctx, landmarks, canvas.width, canvas.height);
      }
    }
    
    ctx.restore();
  }

  private applyBeautyEffects(
    ctx: CanvasRenderingContext2D, 
    landmarks: any[], 
    width: number, 
    height: number
  ) {
    const { smoothing, brightening, eyeEnlargement } = this.config.beauty;
    
    // Apply smoothing filter
    if (smoothing > 0) {
      ctx.filter = `blur(${smoothing * 2}px)`;
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = smoothing * 0.3;
      ctx.drawImage(this.canvas!, 0, 0);
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    
    // Apply brightening
    if (brightening > 0) {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = brightening * 0.2;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    
    // Eye enlargement (basic implementation)
    if (eyeEnlargement > 0) {
      this.enlargeEyes(ctx, landmarks, width, height, eyeEnlargement);
    }
  }

  private enlargeEyes(
    ctx: CanvasRenderingContext2D,
    landmarks: any[],
    width: number,
    height: number,
    intensity: number
  ) {
    // Get eye landmarks
    const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
    const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
    
    // Calculate eye centers and apply enlargement
    const leftEyeCenter = this.getEyeCenter(landmarks, leftEyeIndices, width, height);
    const rightEyeCenter = this.getEyeCenter(landmarks, rightEyeIndices, width, height);
    
    if (leftEyeCenter && rightEyeCenter) {
      this.enlargeRegion(ctx, leftEyeCenter.x, leftEyeCenter.y, 25 * (1 + intensity), intensity);
      this.enlargeRegion(ctx, rightEyeCenter.x, rightEyeCenter.y, 25 * (1 + intensity), intensity);
    }
  }

  private getEyeCenter(landmarks: any[], indices: number[], width: number, height: number) {
    let x = 0, y = 0;
    for (const index of indices) {
      if (landmarks[index]) {
        x += landmarks[index].x * width;
        y += landmarks[index].y * height;
      }
    }
    return { x: x / indices.length, y: y / indices.length };
  }

  private enlargeRegion(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    intensity: number
  ) {
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    const { data, width, height } = imageData;
    
    const scale = 1 + intensity * 0.3;
    const radiusSquared = radius * radius;
    
    for (let y = Math.max(0, centerY - radius); y < Math.min(height, centerY + radius); y++) {
      for (let x = Math.max(0, centerX - radius); x < Math.min(width, centerX + radius); x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distanceSquared = dx * dx + dy * dy;
        
        if (distanceSquared < radiusSquared) {
          const distance = Math.sqrt(distanceSquared);
          const factor = Math.pow(Math.cos(distance / radius * Math.PI / 2), 2);
          
          const sourceX = centerX + dx / scale;
          const sourceY = centerY + dy / scale;
          
          if (sourceX >= 0 && sourceX < width && sourceY >= 0 && sourceY < height) {
            const sourceIndex = (Math.floor(sourceY) * width + Math.floor(sourceX)) * 4;
            const targetIndex = (y * width + x) * 4;
            
            data[targetIndex] = data[sourceIndex] * factor + data[targetIndex] * (1 - factor);
            data[targetIndex + 1] = data[sourceIndex + 1] * factor + data[targetIndex + 1] * (1 - factor);
            data[targetIndex + 2] = data[sourceIndex + 2] * factor + data[targetIndex + 2] * (1 - factor);
          }
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  private applyMask(
    ctx: CanvasRenderingContext2D,
    landmarks: any[],
    width: number,
    height: number
  ) {
    const { type } = this.config.mask;
    
    // Get key facial points
    const noseTip = landmarks[1]; // Nose tip
    const leftEye = landmarks[33]; // Left eye corner
    const rightEye = landmarks[362]; // Right eye corner
    
    if (!noseTip || !leftEye || !rightEye) return;
    
    const centerX = noseTip.x * width;
    const centerY = (noseTip.y - 0.1) * height; // Slightly above nose
    const eyeDistance = Math.abs(leftEye.x - rightEye.x) * width;
    const maskSize = eyeDistance * 2;
    
    ctx.save();
    ctx.font = `${maskSize * 0.8}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    let maskEmoji = '';
    switch (type) {
      case 'cat':
        maskEmoji = '🐱';
        break;
      case 'dog':
        maskEmoji = '🐶';
        break;
      case 'bunny':
        maskEmoji = '🐰';
        break;
      case 'robot':
        maskEmoji = '🤖';
        break;
    }
    
    ctx.fillText(maskEmoji, centerX, centerY);
    ctx.restore();
  }

  private drawDebugLandmarks(
    ctx: CanvasRenderingContext2D,
    landmarks: any[],
    width: number,
    height: number
  ) {
    ctx.save();
    
    // Draw face mesh
    drawConnectors(ctx, landmarks, FACEMESH_TESSELATION, {
      color: '#C0C0C070',
      lineWidth: 1
    });
    
    // Draw eyes
    drawConnectors(ctx, landmarks, FACEMESH_RIGHT_EYE, {
      color: '#FF3030',
      lineWidth: 2
    });
    drawConnectors(ctx, landmarks, FACEMESH_LEFT_EYE, {
      color: '#30FF30',
      lineWidth: 2
    });
    
    ctx.restore();
  }

  public updateConfig(newConfig: Partial<EffectConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public start() {
    if (this.camera) {
      this.camera.start();
    }
  }

  public stop() {
    if (this.camera) {
      this.camera.stop();
    }
    if (this.outputStream) {
      this.outputStream.getTracks().forEach(track => track.stop());
    }
  }

  public getOutputStream(): MediaStream | null {
    return this.outputStream;
  }
}

// Singleton instance
let effectsInstance: VideoEffects | null = null;

export const getVideoEffects = (): VideoEffects => {
  if (!effectsInstance) {
    effectsInstance = new VideoEffects();
  }
  return effectsInstance;
};

export default VideoEffects;