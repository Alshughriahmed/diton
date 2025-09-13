"use client";

interface MessageSystemProps {
  onSend?: (message: string) => void;
  isGuest?: boolean;
}

export default function MessageSystem({ onSend, isGuest = false }: MessageSystemProps){ 
  return null; 
}