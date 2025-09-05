import http from 'k6/http';
import { check } from 'k6';

export let options = {
  thresholds: {
    http_req_failed: ['rate==0'], // No failed requests
    http_req_duration: ['p(95)<5000'], // 95% of requests under 5s
  },
  vus: 5, // 5 virtual users
  duration: '30s', // Run for 30 seconds
};

export default function () {
  // Test homepage
  let homeResponse = http.get(__ENV.BASE_URL || 'http://localhost:5000');
  check(homeResponse, {
    'homepage status is 200': (r) => r.status === 200,
    'homepage response time < 2s': (r) => r.timings.duration < 2000,
  });

  // Test health endpoint
  let healthResponse = http.get(`${__ENV.BASE_URL || 'http://localhost:5000'}/api/health`);
  check(healthResponse, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 1s': (r) => r.timings.duration < 1000,
  });

  // Test plans page
  let plansResponse = http.get(`${__ENV.BASE_URL || 'http://localhost:5000'}/plans`);
  check(plansResponse, {
    'plans status is 200': (r) => r.status === 200,
    'plans response time < 2s': (r) => r.timings.duration < 2000,
  });
}