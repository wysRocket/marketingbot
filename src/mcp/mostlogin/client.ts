import axios from "axios";
import "dotenv/config";

const apiKey = process.env.MOSTLOGIN_API_KEY ?? "";
const host = process.env.MOSTLOGIN_HOST ?? "127.0.0.1:30898";

export const ml = axios.create({
  baseURL: `http://${host}`,
  headers: { Authorization: apiKey },
  timeout: 30_000,
});
