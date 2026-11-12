import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: { steady: { executor: "constant-vus", vus: 5, duration: "30s" } },
  thresholds: { http_req_failed: ["rate<0.02"], http_req_duration: ["p(95)<1500"] },
};

export default function () {
  const query = "latitude=37.7749&longitude=-122.4194&name=San%20Francisco&region=California&country=United%20States&timezone=America%2FLos_Angeles";
  const response = http.get(`${__ENV.API_URL || "http://localhost:8000"}/api/v1/forecast?${query}`);
  check(response, { "forecast returned": (result) => result.status === 200 });
  sleep(1);
}
