"use client";

import { useState, useEffect } from 'react';

export default function SystemMonitor() {
  const [metrics, setMetrics] = useState({
    cpu: 0,
    memory: 0,
    connections: 0,
    latency: 0
  });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/monitoring/metrics');
        const data = await response.json();
        setMetrics(data);
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      }
    };

    const interval = setInterval(fetchMetrics, 5000);
    fetchMetrics();

    return () => clearInterval(interval);
  }, []);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed top-4 left-4 p-2 bg-gray-800 text-white rounded-lg text-xs hover:bg-gray-700 z-50"
      >
        📊
      </button>
    );
  }

  return (
    <div className="fixed top-4 left-4 bg-gray-900 text-white p-4 rounded-lg shadow-xl z-50 min-w-[200px]">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold">System Monitor</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span>CPU:</span>
          <span>{metrics.cpu}%</span>
        </div>
        <div className="flex justify-between">
          <span>Memory:</span>
          <span>{metrics.memory}%</span>
        </div>
        <div className="flex justify-between">
          <span>Active Users:</span>
          <span>{metrics.connections}</span>
        </div>
        <div className="flex justify-between">
          <span>Latency:</span>
          <span>{metrics.latency}ms</span>
        </div>
      </div>
    </div>
  );
}
